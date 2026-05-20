import { NextRequest, NextResponse } from 'next/server';
import { generateText, Output } from 'ai';
import { getModel, extractAIConfig, getProviderOptions, AIConfigError } from '@/lib/ai/provider';
import { resolveUser, getUserIdFromRequest } from '@/lib/auth/helpers';
import { userRepository } from '@/lib/db/repositories/user.repository';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import { isLocalResumeId } from '@/lib/local-resumes';
import { getResumeSectionsContext, normalizeResumeSnapshot, type AIResumeSnapshot } from '@/lib/ai/resume-snapshot';
import { analysisRepository } from '@/lib/db/repositories/analysis.repository';
import { jdAnalysisInputSchema, jdAnalysisOutputSchema } from '@/lib/ai/jd-analysis-schema';
import { extractJson } from '@/lib/ai/extract-json';

const JD_ANALYSIS_PROMPT = `You are an expert resume analyst and career coach. Analyze the match between the provided resume and job description.

IMPORTANT: Detect the primary language of the resume content. You MUST respond entirely in the same language as the resume. If the resume is written in Chinese, all your output (summary, suggestions, keywords) must be in Chinese. If in English, respond in English. Match the resume's language exactly.

Your analysis should be thorough and actionable. You MUST return a JSON object with these exact fields:
- overallScore (number 0-100): Overall match rating
- keywordMatches (string[]): Keywords from the JD that ARE present in the resume
- missingKeywords (string[]): Important keywords from the JD that are NOT in the resume
- suggestions (array of {section, current, suggested}): Actionable improvement suggestions
- applicableSuggestions (array of {sectionType, targetField, current, suggested, reason, evidenceRequired}): Safe section-level changes the user can apply after confirmation
- atsScore (number 0-100): ATS compatibility rating
- summary (string): Concise overall assessment

Rules for applicableSuggestions:
- Only suggest changes that are supported by existing resume facts or clearly mark evidenceRequired=true.
- Use sectionType values from the resume when possible: summary, skills, projects, work_experience.
- Use targetField=text for summary, categories for skills, items/highlights for projects and work_experience.
- suggested must be concrete final resume text, not advice.
- Do not fabricate employers, dates, degrees, metrics, or repository facts.

CRITICAL: You are a JSON API. Your entire response must be a single valid JSON object starting with { and ending with }. Do NOT use markdown syntax. Do NOT wrap in code fences. Do NOT add any text before or after the JSON.`;

export async function POST(request: NextRequest) {
  try {
    const fingerprint = getUserIdFromRequest(request);
    const user = await resolveUser(fingerprint);

    const body = await request.json();
    const parsed = jdAnalysisInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { resumeId, jobDescription } = parsed.data;
    const localResume = isLocalResumeId(resumeId) ? normalizeResumeSnapshot((body as Record<string, unknown>).resume, resumeId) : null;

    let resume: AIResumeSnapshot | NonNullable<Awaited<ReturnType<typeof resumeRepository.findById>>> | null = localResume;
    if (!resume) {
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const cloudResume = await resumeRepository.findById(resumeId);
      if (!cloudResume) {
        return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
      }
      if (cloudResume.userId !== user.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      resume = cloudResume;
    }

    if (!resume) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    }

    // Persist an attempt immediately for cloud resumes so refresh can still show pending/failed state.
    let historyId: string | undefined;
    if (!localResume) {
      try {
        const attempt = await analysisRepository.createJdAnalysisAttempt({ resumeId, jobDescription });
        historyId = attempt?.id;
      } catch (e) {
        console.error('Failed to create JD analysis attempt:', e);
      }
    }

    try {
      const resumeContext = getResumeSectionsContext(resume);
      const aiConfig = await extractAIConfig(request);
      const chargeAICredit = () => aiConfig.mode === 'server' ? userRepository.consumeAICredit(user.id) : Promise.resolve(true);
      const model = getModel(aiConfig);

      const result = await generateText({
        model,
        maxOutputTokens: 8192,
        system: JD_ANALYSIS_PROMPT,
        prompt: `Resume:\n${resumeContext}\n\nJob Description:\n${jobDescription}\n\nRespond with JSON only.`,
        providerOptions: getProviderOptions(aiConfig),
        output: Output.json(),
      });

      const analysisData = extractJson(result.text, jdAnalysisOutputSchema);

      if (historyId) {
        await analysisRepository.markJdAnalysisSuccess(historyId, {
          result: analysisData,
          overallScore: analysisData.overallScore,
          atsScore: analysisData.atsScore,
        });
      }

      await chargeAICredit();
      return NextResponse.json({ ...analysisData, historyId });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to analyze job description match';
      if (historyId) {
        await analysisRepository.markJdAnalysisFailed(historyId, message).catch((e) => {
          console.error('Failed to mark JD analysis failed:', e);
        });
      }
      if (error instanceof AIConfigError) {
        return NextResponse.json({ error: error.message, historyId }, { status: 401 });
      }
      console.error('POST /api/ai/jd-analysis error:', error);
      return NextResponse.json({ error: message, historyId }, { status: 500 });
    }
  } catch (error) {
    console.error('POST /api/ai/jd-analysis setup error:', error);
    return NextResponse.json({ error: 'Failed to analyze job description match' }, { status: 500 });
  }
}
