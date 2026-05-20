import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { analysisRepository } from '@/lib/db/repositories/analysis.repository';
import { jobTemplateRepository, toJobTemplate, type JobTemplateRecord } from '@/lib/db/repositories/job-template.repository';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import { shareRepository } from '@/lib/db/repositories/share.repository';
import { hashPassword } from '@/lib/utils/share';

type JdSource = {
  id: string;
  label: string;
  description?: string;
  jobDescription: string;
  source: 'resume' | 'history' | 'template';
};

type UserResume = Awaited<ReturnType<typeof resumeRepository.findAllByUserId>>[number];

function compact(value?: string | null) {
  return String(value || '').trim();
}

function makeResumeLabel(resume: { title?: string | null; targetCompany?: string | null; targetJobTitle?: string | null }) {
  const target = [compact(resume.targetCompany), compact(resume.targetJobTitle)].filter(Boolean).join(' · ');
  return target || compact(resume.title) || 'Resume JD';
}

function normalizeJd(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

async function resolveSharedResume(token: string, password: string | null) {
  const share = await shareRepository.findByToken(token);
  if (share) {
    if (!share.isActive) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
    if (share.password) {
      if (!password || await hashPassword(password) !== share.password) {
        return { error: NextResponse.json({ error: 'Invalid password' }, { status: 401 }) };
      }
    }
    const resume = await resumeRepository.findById(share.resumeId);
    if (!resume) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
    return { resume };
  }

  const resume = await resumeRepository.findByShareToken(token);
  if (!resume || !resume.isPublic) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  if (resume.sharePassword) {
    if (!password || await hashPassword(password) !== resume.sharePassword) {
      return { error: NextResponse.json({ error: 'Invalid password' }, { status: 401 }) };
    }
  }
  return { resume };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { token } = await params;
    const result = await resolveSharedResume(token, request.nextUrl.searchParams.get('password'));
    if (result.error) return result.error;
    const sharedResume = result.resume!;

    const sources: JdSource[] = [];
    const seen = new Set<string>();
    const addSource = (source: JdSource) => {
      const jd = compact(source.jobDescription);
      if (!jd) return;
      const key = normalizeJd(jd);
      if (seen.has(key)) return;
      seen.add(key);
      sources.push({ ...source, jobDescription: jd });
    };

    const userResumes = await resumeRepository.findAllByUserId(user.id) as UserResume[];

    // If the signed-in user owns the shared resume, put its saved target JD first.
    if (sharedResume.userId === user.id && compact(sharedResume.jobDescription)) {
      addSource({
        id: `resume:${sharedResume.id}`,
        label: makeResumeLabel(sharedResume),
        description: compact(sharedResume.title),
        jobDescription: compact(sharedResume.jobDescription),
        source: 'resume',
      });
    }

    for (const resume of userResumes) {
      if (!compact(resume.jobDescription)) continue;
      addSource({
        id: `resume:${resume.id}`,
        label: makeResumeLabel(resume),
        description: compact(resume.title),
        jobDescription: compact(resume.jobDescription),
        source: 'resume',
      });
    }

    const historyGroups = await Promise.all(
      userResumes.slice(0, 12).map((resume: UserResume) =>
        analysisRepository.findJdAnalysesByResumeId(resume.id, 5)
          .then((items) => ({ resume, items }))
          .catch(() => ({ resume, items: [] }))
      )
    );

    for (const group of historyGroups) {
      for (const item of group.items) {
        if (!compact(item.jobDescription)) continue;
        addSource({
          id: `history:${item.id}`,
          label: `${makeResumeLabel(group.resume)} · ${item.overallScore}`,
          description: compact(group.resume.title),
          jobDescription: compact(item.jobDescription),
          source: 'history',
        });
      }
    }

    const templates = await jobTemplateRepository.listByOwner(user.id).catch(() => [] as JobTemplateRecord[]);
    for (const row of templates) {
      const template = toJobTemplate(row);
      addSource({
        id: `template:${row.id}`,
        label: template.title,
        description: template.industry,
        jobDescription: template.jd,
        source: 'template',
      });
    }

    return NextResponse.json(sources.slice(0, 40));
  } catch (error) {
    console.error('GET /api/share/[token]/jd-sources error:', error);
    return NextResponse.json({ error: 'Failed to fetch JD sources' }, { status: 500 });
  }
}
