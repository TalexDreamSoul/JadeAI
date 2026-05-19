import { NextRequest, NextResponse } from 'next/server';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { userRepository } from '@/lib/db/repositories/user.repository';
import { getModel, extractAIConfig, getProviderOptions, AIConfigError } from '@/lib/ai/provider';
import { extractJson } from '@/lib/ai/extract-json';
import { aiReviewRepository } from '@/lib/db/repositories/ai-review.repository';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';

const aiReviewSchema = z.object({
  score: z.number().min(0).max(100),
  summary: z.string(),
  strengths: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  actions: z.array(z.object({
    section: z.string(),
    priority: z.enum(['high', 'medium', 'low']).default('medium'),
    suggestion: z.string(),
  })).default([]),
});

const SYSTEM = `You are a senior resume reviewer. Review the resume for recruiter readability, ATS quality, impact, clarity, role alignment, and visual presentation fit.
When a JD is provided, judge whether the resume's template/style/theme, information density, section order, and tone fit the target role and industry. Do not only review text; include visual and layout risks when relevant.
Return JSON only with fields: score, summary, strengths, risks, actions. Match the resume language.`;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const resume = await resumeRepository.findById(id);
    if (!resume) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (resume.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    return NextResponse.json(await aiReviewRepository.findByResumeId(id));
  } catch (error) {
    console.error('GET /api/resume/[id]/ai-review error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const resume = await resumeRepository.findById(id);
    if (!resume) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (resume.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const aiConfig = await extractAIConfig(request);
    const chargeAICredit = () => aiConfig.mode === 'server' ? userRepository.consumeAICredit(user.id) : Promise.resolve(true);
    const result = await generateText({
      model: getModel(aiConfig),
      system: SYSTEM,
      prompt: JSON.stringify({
        resume: resume.sections,
        template: resume.template,
        themeConfig: resume.themeConfig,
        targetCompany: resume.targetCompany,
        targetJobTitle: resume.targetJobTitle,
        jobDescription: resume.jobDescription,
        focus: body.focus || 'overall',
      }),
      maxOutputTokens: 4096,
      providerOptions: getProviderOptions(aiConfig),
      output: Output.json(),
    });

    const review = extractJson(result.text, aiReviewSchema);
    const saved = await aiReviewRepository.create({
      resumeId: id,
      userId: user.id,
      result: review,
      score: review.score,
    });
    await resumeRepository.createEvent({
      resumeId: id,
      userId: user.id,
      type: 'resume.ai_reviewed',
      title: 'AI review completed',
      metadata: { score: review.score, reviewId: saved?.id },
    });
    await chargeAICredit();
    return NextResponse.json({ ...review, historyId: saved?.id });
  } catch (error) {
    if (error instanceof AIConfigError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error('POST /api/resume/[id]/ai-review error:', error);
    return NextResponse.json({ error: 'Failed to review resume' }, { status: 500 });
  }
}
