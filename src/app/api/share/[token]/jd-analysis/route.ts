import { NextRequest, NextResponse } from 'next/server';
import { getModel, extractAIConfig, getProviderOptions, AIConfigError } from '@/lib/ai/provider';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import { shareRepository } from '@/lib/db/repositories/share.repository';
import { jdAnalysisOutputSchema } from '@/lib/ai/jd-analysis-schema';
import { generateJsonWithRetry, getAIJsonErrorMessage } from '@/lib/ai/generate-json';
import { sanitizeResumeForShare } from '@/lib/share/review';
import { hashPassword } from '@/lib/utils/share';
import { AIUsageInsufficientCreditsError, withMeteredAIUsage } from '@/lib/commercial/ai-route-metering';

const JD_ANALYSIS_PROMPT = `You are an expert resume analyst and career coach. Analyze the match between the provided resume and job description.

IMPORTANT: Detect the primary language of the resume content. You MUST respond entirely in the same language as the resume. If the resume is written in Chinese, all your output (summary, suggestions, keywords) must be in Chinese. If in English, respond in English. Match the resume's language exactly.

Your analysis should be thorough and actionable. You MUST return a JSON object with these exact fields:
- overallScore (number 0-100): Overall match rating
- keywordMatches (string[]): Keywords from the JD that ARE present in the resume
- missingKeywords (string[]): Important keywords from the JD that are NOT in the resume
- suggestions (array of {section, current, suggested}): Actionable improvement suggestions
- atsScore (number 0-100): ATS compatibility rating
- summary (string): Concise overall assessment

CRITICAL: You are a JSON API. Your entire response must be a single valid JSON object starting with { and ending with }. Do NOT use markdown syntax. Do NOT wrap in code fences. Do NOT add any text before or after the JSON.`;

async function resolveShare(token: string, password: string | null) {
  const share = await shareRepository.findByToken(token);
  if (!share || !share.isActive) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  if (!share.reviewEnabled) return { error: NextResponse.json({ error: 'Review is disabled' }, { status: 403 }) };
  if (share.password) {
    if (!password) return { error: NextResponse.json({ error: 'Password required', passwordRequired: true }, { status: 401 }) };
    if (await hashPassword(password) !== share.password) {
      return { error: NextResponse.json({ error: 'Invalid password', passwordRequired: true }, { status: 401 }) };
    }
  }
  return { share };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json().catch(() => ({}));
    const result = await resolveShare(token, body.password ? String(body.password) : null);
    if (result.error) return result.error;

    const user = await resolveUser(getUserIdFromRequest(request));
    if (result.share!.viewRequiresLogin && !user) {
      return NextResponse.json({ error: 'Login required', loginRequired: true }, { status: 401 });
    }

    const jobDescription = String(body.jobDescription || '').trim();
    if (!jobDescription) return NextResponse.json({ error: 'Job description is required' }, { status: 400 });

    const rawResume = await resumeRepository.findById(result.share!.resumeId);
    if (!rawResume) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const resume = sanitizeResumeForShare(rawResume, !!result.share!.hideSensitiveInfo);

    const aiConfig = await extractAIConfig(request);
    const analysis = await withMeteredAIUsage({
      userId: user?.id,
      aiConfig,
      feature: 'share.jd_analysis',
      metadata: { token, resumeId: result.share!.resumeId, jdLength: jobDescription.length },
      run: async () => {
        const { data, usage } = await generateJsonWithRetry({
          label: 'shared-jd-analysis',
          model: getModel(aiConfig),
          schema: jdAnalysisOutputSchema,
          maxOutputTokens: 8192,
          system: JD_ANALYSIS_PROMPT,
          prompt: `Resume:\n${JSON.stringify(resume.sections)}\n\nJob Description:\n${jobDescription}\n\nRespond with JSON only.`,
          providerOptions: getProviderOptions(aiConfig),
        });
        return {
          value: data,
          usage,
          metadata: { token, resumeId: result.share!.resumeId, jdLength: jobDescription.length },
        };
      },
    });
    return NextResponse.json(analysis);
  } catch (error) {
    if (error instanceof AIConfigError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof AIUsageInsufficientCreditsError) {
      return NextResponse.json({ error: error.message }, { status: 402 });
    }
    console.error('POST /api/share/[token]/jd-analysis error:', error);
    return NextResponse.json({ error: getAIJsonErrorMessage(error, 'Failed to analyze job description match') }, { status: 500 });
  }
}
