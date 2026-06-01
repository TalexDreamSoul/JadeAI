import { NextRequest, NextResponse } from 'next/server';
import { generateText, Output } from 'ai';
import { z } from 'zod/v4';
import { extractAIConfig, getModel, getProviderOptions, AIConfigError, type AIConfig } from '@/lib/ai/provider';
import { extractJson } from '@/lib/ai/extract-json';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { userProfileMemoryRepository } from '@/lib/db/repositories/user-profile-memory.repository';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import { userRepository } from '@/lib/db/repositories/user.repository';
import type { ResumeSection } from '@/types/resume';
import { AIUsageInsufficientCreditsError } from '@/lib/commercial/ai-route-metering';
import { completeAIUsage, refundAIUsage } from '@/lib/commercial/ai-metering-service';

type MutableSectionContent = Record<string, unknown>;
type ProjectDraft = {
  id: string;
  name: string;
  url: string;
  description: string;
  technologies: string[];
  highlights: string[];
  source?: string;
  githubRepo?: {
    provider: 'github';
    fullName: string;
    url: string;
    stars: number;
    language: string;
    languages: Record<string, number>;
    defaultBranch: string;
    topics: string[];
  };
};

const inputSchema = z.object({
  resumeId: z.string().min(1),
  repoUrl: z.string().min(1),
  targetRole: z.string().optional(),
  token: z.string().optional(),
});

const summarySchema = z.object({
  name: z.string(),
  description: z.string(),
  technologies: z.array(z.string()).default([]),
  highlights: z.array(z.string()).default([]),
});

type RepoSummary = z.infer<typeof summarySchema>;

function parseGitHubUrl(url: string) {
  const match = url.match(/github\.com\/([^/]+)\/([^/#?]+)/i);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

async function fetchRepoMetadata(repoUrl: string, token?: string) {
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) throw new Error('Unsupported GitHub URL');

  const headers: Record<string, string> = { Accept: 'application/vnd.github.v3+json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const [repoRes, readmeRes, languagesRes] = await Promise.all([
    fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`, { headers, next: { revalidate: 300 } }),
    fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/readme`, { headers, next: { revalidate: 300 } }),
    fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/languages`, { headers, next: { revalidate: 300 } }),
  ]);

  if (!repoRes.ok) {
    if (repoRes.status === 404) throw new Error('Repository not found');
    if (repoRes.status === 403) throw new Error('GitHub API rate limit exceeded');
    throw new Error('Failed to fetch repository');
  }

  const repo = await repoRes.json();
  const languages = languagesRes.ok ? await languagesRes.json() : {};
  const readmeData = readmeRes.ok ? await readmeRes.json() : null;
  const readme = readmeData?.content
    ? Buffer.from(readmeData.content, 'base64').toString('utf8').slice(0, 8000)
    : '';

  return {
    provider: 'github',
    name: repo.full_name,
    stars: repo.stargazers_count || 0,
    language: repo.language || '',
    languages,
    description: repo.description || '',
    url: repo.html_url || repoUrl,
    defaultBranch: repo.default_branch || '',
    topics: repo.topics || [],
    readme,
  };
}

function fallbackRepoSummary(repo: Awaited<ReturnType<typeof fetchRepoMetadata>>): RepoSummary {
  return {
    name: repo.name,
    description: repo.description || `${repo.name} 项目经历`,
    technologies: Object.keys(repo.languages || {}).slice(0, 8),
    highlights: [
      repo.stars > 0 ? `GitHub 获得 ${repo.stars.toLocaleString()} stars` : '',
      repo.topics?.length ? `覆盖 ${repo.topics.slice(0, 4).join('、')} 等主题` : '',
    ].filter(Boolean),
  };
}

async function summarizeRepoWithAI(
  aiConfig: AIConfig,
  repo: Awaited<ReturnType<typeof fetchRepoMetadata>>,
  targetRole: string,
  language: string
) {
  const result = await generateText({
    model: getModel(aiConfig),
    system: 'You write factual resume project entries from GitHub repository metadata. Return JSON only. Do not invent metrics, employers, or users.',
    prompt: JSON.stringify({ repo, targetRole, language }),
    maxOutputTokens: 2048,
    providerOptions: getProviderOptions(aiConfig),
    output: Output.json(),
  });
  return {
    summary: extractJson(result.text, summarySchema),
    usage: result.usage,
  };
}

export async function POST(request: NextRequest) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = inputSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
    }

    const { resumeId, repoUrl, targetRole, token } = parsed.data;
    const resume = await resumeRepository.findById(resumeId);
    if (!resume) return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    if (resume.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const repo = await fetchRepoMetadata(repoUrl, token);
    const aiConfig = await extractAIConfig(request);
    const meteringMetadata = { resumeId, repoUrl: repo.url, targetRole: targetRole || resume.targetJobTitle || '' };

    const persistProject = async (summary: RepoSummary) => {
      let projectsSection: ResumeSection | null =
        (resume.sections as ResumeSection[]).find((section) => section.type === 'projects') || null;
      if (!projectsSection) {
        const maxOrder = (resume.sections as ResumeSection[]).reduce((max, section) => Math.max(max, section.sortOrder), -1);
        projectsSection = await resumeRepository.createSection({
          resumeId,
          type: 'projects',
          title: resume.language === 'en' ? 'Projects' : '项目经历',
          sortOrder: maxOrder + 1,
          content: { items: [] },
        }) as ResumeSection | null;
      }

      if (!projectsSection) {
        throw new Error('Failed to create projects section');
      }

      const content: MutableSectionContent = { ...(projectsSection.content as unknown as MutableSectionContent) };
      const items: ProjectDraft[] = Array.isArray(content.items) ? [...(content.items as ProjectDraft[])] : [];
      const project: ProjectDraft = {
        id: crypto.randomUUID(),
        name: summary.name || repo.name,
        url: repo.url,
        description: summary.description || repo.description || '',
        technologies: summary.technologies?.length ? summary.technologies : Object.keys(repo.languages || {}).slice(0, 8),
        highlights: summary.highlights || [],
        source: 'github',
        githubRepo: {
          provider: 'github',
          fullName: repo.name,
          url: repo.url,
          stars: repo.stars,
          language: repo.language,
          languages: repo.languages,
          defaultBranch: repo.defaultBranch,
          topics: repo.topics,
        },
      };
      items.push(project);

      await resumeRepository.updateSection(projectsSection.id, { content: { ...content, items } });
      const updated = await resumeRepository.findById(resumeId);

      await userProfileMemoryRepository.create({
        userId: user.id,
        type: 'project_fact',
        title: project.name,
        content: [project.description, ...project.highlights].filter(Boolean).join('\n'),
        source: 'github',
        confidence: 90,
        metadata: { repoUrl: repo.url, stars: repo.stars, languages: repo.languages },
      }).catch(() => null);

      await resumeRepository.createEvent({
        resumeId,
        userId: user.id,
        type: 'career.github_project_imported',
        title: 'GitHub project imported',
        description: repo.url,
        metadata: { project },
      }).catch(() => null);

      return { project, updated };
    };

    if (aiConfig.mode === 'server') {
      const reserved = await userRepository.reserveAICredit(user.id, {
        feature: 'career.github_project_import',
        aiConfig,
        metadata: meteringMetadata,
      });
      if (!reserved.ok) {
        throw new AIUsageInsufficientCreditsError(reserved.error);
      }

      let generated: Awaited<ReturnType<typeof summarizeRepoWithAI>> | null = null;
      try {
        generated = await summarizeRepoWithAI(aiConfig, repo, targetRole || resume.targetJobTitle || '', resume.language || 'zh');
      } catch (error) {
        await refundAIUsage(reserved.reservation, error, meteringMetadata)
          .catch((refundError) => console.error('[ai-metering] github project refund failed:', refundError));
        const result = await persistProject(fallbackRepoSummary(repo));
        return NextResponse.json({ repo, project: result.project, resume: result.updated }, { status: 201 });
      }

      try {
        const result = await persistProject(generated.summary);
        await completeAIUsage(reserved.reservation, generated.usage, {
          ...meteringMetadata,
          projectId: result.project.id,
        });
        return NextResponse.json({ repo, project: result.project, resume: result.updated }, { status: 201 });
      } catch (error) {
        await refundAIUsage(reserved.reservation, error, meteringMetadata)
          .catch((refundError) => console.error('[ai-metering] github project refund failed:', refundError));
        throw error;
      }
    }

    let summary = fallbackRepoSummary(repo);
    try {
      summary = (await summarizeRepoWithAI(aiConfig, repo, targetRole || resume.targetJobTitle || '', resume.language || 'zh')).summary;
    } catch (error) {
      if (error instanceof AIConfigError) throw error;
    }
    const result = await persistProject(summary);
    return NextResponse.json({ repo, project: result.project, resume: result.updated }, { status: 201 });
  } catch (error) {
    if (error instanceof AIConfigError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof AIUsageInsufficientCreditsError) {
      return NextResponse.json({ error: error.message }, { status: 402 });
    }
    console.error('POST /api/career/github-project error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
