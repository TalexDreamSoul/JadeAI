import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { getModel, extractAIConfig, getProviderOptions, AIConfigError } from '@/lib/ai/provider';
import { generateJsonWithRetry, getAIJsonErrorMessage } from '@/lib/ai/generate-json';
import { aiReviewSchema } from '@/lib/ai/ai-review-schema';
import { aiReviewRepository } from '@/lib/db/repositories/ai-review.repository';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import { AIUsageInsufficientCreditsError, withMeteredAIUsage } from '@/lib/commercial/ai-route-metering';

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
    const attempt = await aiReviewRepository.createAttempt({ resumeId: id, userId: user.id });
    const historyId = attempt?.id;

    try {
      const aiConfig = await extractAIConfig(request);
      const review = await withMeteredAIUsage({
        userId: user.id,
        aiConfig,
        feature: 'resume.ai_review',
        metadata: { resumeId: id, historyId, focus: body.focus || 'overall' },
        run: async () => {
          const { data, usage } = await generateJsonWithRetry({
            label: 'resume-ai-review',
            model: getModel(aiConfig),
            schema: aiReviewSchema,
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
          });
          return {
            value: data,
            usage,
            metadata: { resumeId: id, historyId, focus: body.focus || 'overall' },
          };
        },
      });
      if (historyId) await aiReviewRepository.markSuccess(historyId, { result: review, score: review.score });
      await resumeRepository.createEvent({
        resumeId: id,
        userId: user.id,
        type: 'resume.ai_reviewed',
        title: 'AI review completed',
        metadata: { score: review.score, reviewId: historyId },
      });
      return NextResponse.json({ ...review, historyId });
    } catch (error) {
      const message = getAIJsonErrorMessage(error, 'Failed to review resume');
      if (historyId) await aiReviewRepository.markFailed(historyId, message).catch(() => null);
      if (error instanceof AIConfigError) {
        return NextResponse.json({ error: error.message, historyId }, { status: 401 });
      }
      if (error instanceof AIUsageInsufficientCreditsError) {
        return NextResponse.json({ error: error.message, historyId }, { status: 402 });
      }
      console.error('POST /api/resume/[id]/ai-review error:', error);
      return NextResponse.json({ error: message, historyId }, { status: 500 });
    }
  } catch (error) {
    console.error('POST /api/resume/[id]/ai-review setup error:', error);
    return NextResponse.json({ error: 'Failed to review resume' }, { status: 500 });
  }
}
