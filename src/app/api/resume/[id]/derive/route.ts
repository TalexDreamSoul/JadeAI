import { NextRequest, NextResponse } from 'next/server';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { userRepository } from '@/lib/db/repositories/user.repository';
import { extractJson } from '@/lib/ai/extract-json';
import { extractAIConfig, getModel, getProviderOptions } from '@/lib/ai/provider';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';

const tailoringSchema = z.object({
  summary: z.object({ text: z.string() }).optional(),
  skills: z.object({
    categories: z.array(z.object({
      name: z.string(),
      skills: z.array(z.string()),
    })),
  }).optional(),
  projects: z.object({
    items: z.array(z.object({
      name: z.string(),
      url: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      description: z.string(),
      technologies: z.array(z.string()).default([]),
      highlights: z.array(z.string()).default([]),
    })),
  }).optional(),
});

async function tailorDerivedResume(request: NextRequest, resume: Awaited<ReturnType<typeof resumeRepository.findById>>, jobDescription: string) {
  if (!resume || !jobDescription) return false;
  const aiConfig = await extractAIConfig(request);
  if (!aiConfig.apiKey) return false;

  const result = await generateText({
    model: getModel(aiConfig),
    system: 'You tailor resume content for a target JD. Return JSON only with optional summary, skills, projects. Preserve the resume language.',
    prompt: JSON.stringify({
      jobDescription,
      sections: resume.sections,
    }),
    maxOutputTokens: 4096,
    providerOptions: getProviderOptions(aiConfig),
    output: Output.json(),
  });

  const tailored = extractJson(result.text, tailoringSchema);
  for (const section of resume.sections) {
    if (section.type === 'summary' && tailored.summary) {
      await resumeRepository.updateSection(section.id, { content: tailored.summary });
    }
    if (section.type === 'skills' && tailored.skills) {
      await resumeRepository.updateSection(section.id, { content: tailored.skills });
    }
    if (section.type === 'projects' && tailored.projects) {
      await resumeRepository.updateSection(section.id, { content: tailored.projects });
    }
  }
  return aiConfig.mode === 'server';
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const fingerprint = getUserIdFromRequest(request);
    const user = await resolveUser(fingerprint);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const resume = await resumeRepository.findById(id);
    if (!resume) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (resume.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const targetCompany = String(body.targetCompany || '').trim();
    const targetJobTitle = String(body.targetJobTitle || '').trim();
    const jobDescription = String(body.jobDescription || '').trim();
    const title = String(body.title || '').trim()
      || `${resume.title} - ${targetCompany || targetJobTitle || 'JD'}`;

    const derived = await resumeRepository.duplicate(id, user.id, title, {
      baseResumeId: resume.isBase ? resume.id : resume.baseResumeId || resume.id,
      targetCompany: targetCompany || null,
      targetJobTitle: targetJobTitle || null,
      jobDescription: jobDescription || null,
      versionLabel: 'jd-v1',
    });

    if (!derived) return NextResponse.json({ error: 'Failed to derive resume' }, { status: 500 });

    let shouldChargeAICredit = false;
    if (jobDescription) {
      shouldChargeAICredit = await tailorDerivedResume(request, derived, jobDescription).catch((error) => {
        console.error('Failed to tailor derived resume:', error);
        return false;
      });
    }

    const tailoredDerived = await resumeRepository.findById(derived.id);

    await resumeRepository.createEvent({
      resumeId: tailoredDerived?.id || derived.id,
      userId: user.id,
      type: 'resume.derived',
      title: 'Derived resume created',
      description: targetCompany || targetJobTitle || '',
      metadata: { sourceResumeId: resume.id, targetCompany, targetJobTitle, tailored: !!jobDescription },
    });
    await resumeRepository.createVersion(derived.id, 'jd-v1', tailoredDerived || derived, 'jd');

    if (shouldChargeAICredit) {
      await userRepository.consumeAICredit(user.id);
    }
    return NextResponse.json(tailoredDerived || derived, { status: 201 });
  } catch (error) {
    console.error('POST /api/resume/[id]/derive error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
