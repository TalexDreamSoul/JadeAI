import { NextRequest, NextResponse } from 'next/server';
import { getModel, extractAIConfig, getProviderOptions, AIConfigError } from '@/lib/ai/provider';
import { userRepository } from '@/lib/db/repositories/user.repository';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { generateJsonWithRetry, getAIJsonErrorMessage } from '@/lib/ai/generate-json';
import { aiReviewSchema } from '@/lib/ai/ai-review-schema';
import { getResumeSectionsContext, normalizeResumeSnapshot } from '@/lib/ai/resume-snapshot';

const SYSTEM = `You are a senior resume reviewer. Review the resume for recruiter readability, ATS quality, impact, clarity, and role alignment.
Return JSON only with fields: score, summary, strengths, risks, actions. Match the resume language.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const resume = normalizeResumeSnapshot(body.resume, body.resumeId || 'local');
    if (!resume) {
      return NextResponse.json({ error: 'Resume snapshot is required' }, { status: 400 });
    }

    const user = await resolveUser(getUserIdFromRequest(request));
    const aiConfig = await extractAIConfig(request);
    const chargeAICredit = () => aiConfig.mode === 'server' ? userRepository.consumeAICredit(user.id) : Promise.resolve(true);
    const { data: review } = await generateJsonWithRetry({
      label: 'local-resume-review',
      model: getModel(aiConfig),
      schema: aiReviewSchema,
      system: SYSTEM,
      prompt: JSON.stringify({
        resume: JSON.parse(getResumeSectionsContext(resume)),
        targetCompany: resume.targetCompany,
        targetJobTitle: resume.targetJobTitle,
        jobDescription: resume.jobDescription,
        focus: body.focus || 'overall',
      }),
      maxOutputTokens: 4096,
      providerOptions: getProviderOptions(aiConfig),
    });
    await chargeAICredit();
    return NextResponse.json(review);
  } catch (error) {
    if (error instanceof AIConfigError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error('POST /api/ai/resume-review error:', error);
    return NextResponse.json({ error: getAIJsonErrorMessage(error, 'Failed to review resume') }, { status: 500 });
  }
}
