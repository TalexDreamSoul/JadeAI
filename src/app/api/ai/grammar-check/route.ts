import { NextRequest, NextResponse } from 'next/server';
import { generateText, Output } from 'ai';
import { getModel, extractAIConfig, getProviderOptions, AIConfigError } from '@/lib/ai/provider';
import { resolveUser, getUserIdFromRequest } from '@/lib/auth/helpers';
import { userRepository } from '@/lib/db/repositories/user.repository';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import { isLocalResumeId } from '@/lib/local-resumes';
import { normalizeResumeSnapshot, type AIResumeSnapshot } from '@/lib/ai/resume-snapshot';
import { analysisRepository } from '@/lib/db/repositories/analysis.repository';
import { grammarCheckInputSchema, grammarCheckOutputSchema } from '@/lib/ai/grammar-check-schema';
import { extractJson } from '@/lib/ai/extract-json';

const GRAMMAR_CHECK_PROMPT = `You are an expert resume reviewer and writing coach. Analyze the provided resume sections for writing quality issues.

IMPORTANT: Detect the primary language of the resume content. You MUST respond entirely in the same language as the resume. If the resume is written in Chinese, all your output (summary, suggestions, sectionTitle) must be in Chinese. If in English, respond in English. Match the resume's language exactly.

You must detect and report these types of issues:
- grammar: Grammatical errors, incorrect tense, subject-verb disagreement, article misuse
- spelling: Misspelled words or typos
- weak_verb: Weak or passive verbs that should be replaced with strong action verbs
- vague: Vague or generic descriptions that lack specificity
- quantify: Descriptions that could be improved with quantifiable metrics

Analysis guidelines:
- Check every text field in every section: titles, descriptions, highlights, summary text
- For each issue, provide the exact original text and a concrete suggestion
- Set severity: "high" for grammar/spelling errors, "medium" for weak verbs and vague descriptions, "low" for quantify suggestions
- Be thorough but practical — only flag genuinely improvable items
- Provide a brief overall summary of the writing quality
- Assign a score from 0-100 (100 = perfect, no issues found)

You MUST return a JSON object with exactly these fields:
- issues: array of { sectionId, sectionTitle, type, original, suggestion, severity }
- summary: string with overall assessment
- score: number from 0 to 100

CRITICAL: You are a JSON API. Your entire response must be a single valid JSON object starting with { and ending with }. Do NOT use markdown syntax. Do NOT wrap in code fences. Do NOT add any text before or after the JSON.`;

type ResumeSectionRecord = {
  id: string;
  title: string;
  type: string;
  content: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const fingerprint = getUserIdFromRequest(request);
    const user = await resolveUser(fingerprint);

    const body = await request.json();
    const parsed = grammarCheckInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { resumeId, sectionIds } = parsed.data;
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

    // Filter sections if specific IDs are provided
    const sectionsToCheck = sectionIds
      ? (resume.sections as ResumeSectionRecord[]).filter((s) => sectionIds.includes(s.id))
      : (resume.sections as ResumeSectionRecord[]);

    if (sectionsToCheck.length === 0) {
      return NextResponse.json({ error: 'No sections found to check' }, { status: 400 });
    }

    // Prepare sections data for AI analysis
    const sectionsData = sectionsToCheck.map((s) => ({
      sectionId: s.id,
      sectionTitle: s.title,
      type: s.type,
      content: s.content,
    }));

    let historyId: string | undefined;
    if (!localResume) {
      try {
        const attempt = await analysisRepository.createGrammarCheckAttempt({ resumeId });
        historyId = attempt?.id;
      } catch (e) {
        console.error('Failed to create grammar check attempt:', e);
      }
    }

    try {
      const aiConfig = await extractAIConfig(request);
      const chargeAICredit = () => aiConfig.mode === 'server' ? userRepository.consumeAICredit(user.id) : Promise.resolve(true);
      const model = getModel(aiConfig);

      const result = await generateText({
        model,
        maxOutputTokens: 8192,
        system: GRAMMAR_CHECK_PROMPT,
        prompt: `Analyze the following resume sections. Respond with JSON only.\n\n${JSON.stringify(sectionsData, null, 2)}`,
        providerOptions: getProviderOptions(aiConfig),
        output: Output.json(),
      });

      console.log('[grammar-check] raw response:\n', result.text);
      const checkResult = extractJson(result.text, grammarCheckOutputSchema);

      if (historyId) {
        await analysisRepository.markGrammarCheckSuccess(historyId, {
          result: checkResult,
          score: checkResult.score,
          issueCount: checkResult.issues.length,
        });
      }

      await chargeAICredit();
      return NextResponse.json({ ...checkResult, historyId });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to check grammar';
      if (historyId) await analysisRepository.markGrammarCheckFailed(historyId, message).catch(() => null);
      if (error instanceof AIConfigError) {
        return NextResponse.json({ error: error.message, historyId }, { status: 401 });
      }
      console.error('POST /api/ai/grammar-check error:', error);
      return NextResponse.json({ error: message, historyId }, { status: 500 });
    }
  } catch (error) {
    console.error('POST /api/ai/grammar-check setup error:', error);
    return NextResponse.json({ error: 'Failed to check grammar' }, { status: 500 });
  }
}
