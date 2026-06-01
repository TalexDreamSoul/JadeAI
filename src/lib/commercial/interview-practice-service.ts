import { z } from 'zod/v4';
import { getModel, getProviderOptions, type AIConfig } from '@/lib/ai/provider';
import { generateJsonWithRetry } from '@/lib/ai/generate-json';
import { withMeteredAIUsage } from './ai-route-metering';
import { parseJsonArray, parseJsonObject } from './json';

const aiAnswerEvaluationSchema = z.object({
  evaluations: z.array(z.object({
    questionId: z.string(),
    score: z.number().min(0).max(100),
    isCorrect: z.boolean().optional(),
    feedback: z.string().default(''),
    strengths: z.array(z.string()).default([]),
    improvements: z.array(z.string()).default([]),
    matchedKeywords: z.array(z.string()).default([]),
    missingKeywords: z.array(z.string()).default([]),
    dimensionScores: z.array(z.object({
      dimension: z.string(),
      score: z.number().min(0).max(100),
      comment: z.string().default(''),
    })).default([]),
    referenceTips: z.string().default(''),
  })).default([]),
});

type QuestionLike = {
  id: string;
  dimension: string;
  difficulty: string;
  questionType: string;
  prompt: string;
  keywords: unknown;
  rubric: unknown;
  referenceAnswer: string;
};

type AnswerLike = {
  questionId: string;
  answer: string;
};

export function scoreInterviewAnswer(question: {
  keywords: unknown;
  rubric: unknown;
  referenceAnswer: string;
}, answer: string) {
  const normalizedAnswer = answer.trim().toLowerCase();
  const keywords = parseJsonArray<string>(question.keywords)
    .map((item) => String(item).trim())
    .filter(Boolean);
  const matchedKeywords = keywords.filter((keyword) => normalizedAnswer.includes(keyword.toLowerCase()));
  const keywordScore = keywords.length ? Math.round((matchedKeywords.length / keywords.length) * 70) : 35;
  const lengthScore = Math.min(20, Math.floor(normalizedAnswer.length / 30));
  const referenceBonus = question.referenceAnswer && normalizedAnswer.length > 80 ? 10 : 0;
  const score = Math.max(0, Math.min(100, keywordScore + lengthScore + referenceBonus));
  const isCorrect = score >= 60;
  const rubric = parseJsonObject(question.rubric);

  return {
    score,
    isCorrect,
    feedback: isCorrect
      ? '回答覆盖了核心要点，可以继续补充业务场景和取舍。'
      : '回答要点不足，建议补充关键词、真实案例和可验证结果。',
    rubricResult: {
      rubric,
      matchedKeywords,
      missingKeywords: keywords.filter((keyword) => !matchedKeywords.includes(keyword)),
      scoringMode: 'keyword_baseline',
    },
  };
}

export async function scoreInterviewAnswersWithAI(input: {
  userId: string;
  aiConfig: AIConfig;
  bank?: {
    id: string;
    title: string;
    role: string;
    level: string;
  };
  paperId?: string;
  targetRole?: string;
  jobDescription?: string;
  questions: QuestionLike[];
  answers: AnswerLike[];
}) {
  const questionById = new Map(input.questions.map((question) => [question.id, question]));
  const answerPayload = input.answers
    .map((answer) => {
      const question = questionById.get(answer.questionId);
      if (!question) return null;
      return {
        questionId: question.id,
        prompt: question.prompt,
        dimension: question.dimension,
        difficulty: question.difficulty,
        questionType: question.questionType,
        referenceAnswer: question.referenceAnswer,
        rubric: parseJsonObject(question.rubric),
        keywords: parseJsonArray<string>(question.keywords),
        answer: answer.answer,
      };
    })
    .filter(Boolean);

  const result = await withMeteredAIUsage({
    userId: input.userId,
    aiConfig: input.aiConfig,
    feature: 'interview.practice.ai_score',
    credits: Math.max(1, Math.ceil(answerPayload.length / 3)),
    metadata: {
      bankId: input.bank?.id,
      paperId: input.paperId,
      answerCount: answerPayload.length,
      targetRole: input.targetRole || input.bank?.role || '',
    },
    run: async () => {
      const { data, usage } = await generateJsonWithRetry({
        label: 'interview-practice-ai-score',
        model: getModel(input.aiConfig),
        schema: aiAnswerEvaluationSchema,
        system: `You are a senior interviewer and rubric-based interview coach.
Return one valid JSON object only. Score each candidate answer against the question, rubric, keywords, and reference answer.
Scores must be 0-100. Mark isCorrect true when the answer is at least passable for the target role.
Feedback must be concise, actionable, and written in Chinese unless the answer is clearly English.`,
        prompt: JSON.stringify({
          bank: input.bank || null,
          targetRole: input.targetRole || input.bank?.role || '',
          jobDescription: input.jobDescription || '',
          answers: answerPayload,
          outputContract: {
            evaluations: [{
              questionId: 'same id as input',
              score: '0-100',
              isCorrect: 'boolean',
              feedback: 'short actionable feedback',
              strengths: ['specific strengths'],
              improvements: ['specific improvements'],
              matchedKeywords: ['covered rubric keywords'],
              missingKeywords: ['important missing keywords'],
              dimensionScores: [{ dimension: 'dimension name', score: '0-100', comment: 'short reason' }],
              referenceTips: 'better answer direction',
            }],
          },
        }),
        maxOutputTokens: 4096,
        providerOptions: getProviderOptions(input.aiConfig),
      });
      return {
        value: data,
        usage,
        metadata: {
          bankId: input.bank?.id,
          paperId: input.paperId,
          answerCount: answerPayload.length,
          scoringMode: 'ai_rubric',
        },
      };
    },
  });

  const byQuestionId = new Map(result.evaluations.map((evaluation) => {
    const question = questionById.get(evaluation.questionId);
    const baseline = question ? scoreInterviewAnswer(question, input.answers.find((answer) => answer.questionId === evaluation.questionId)?.answer || '') : null;
    return [evaluation.questionId, {
      score: Math.max(0, Math.min(100, Math.round(Number(evaluation.score || 0)))),
      isCorrect: evaluation.isCorrect ?? Number(evaluation.score || 0) >= 60,
      feedback: evaluation.feedback || baseline?.feedback || '',
      rubricResult: {
        rubric: question ? parseJsonObject(question.rubric) : {},
        matchedKeywords: evaluation.matchedKeywords,
        missingKeywords: evaluation.missingKeywords,
        strengths: evaluation.strengths,
        improvements: evaluation.improvements,
        dimensionScores: evaluation.dimensionScores,
        referenceTips: evaluation.referenceTips,
        scoringMode: 'ai_rubric',
      },
    }];
  }));

  return byQuestionId;
}
