import {
  ensureQuestionBankAccessPayload,
  grantPlanQuestionBankEntitlement,
} from './content-entitlement-service';
import { parseJsonObject } from './json';
import { scoreInterviewAnswer, scoreInterviewAnswersWithAI } from './interview-practice-service';
import type { AIConfig } from '@/lib/ai/provider';
import {
  interviewQuestionBankRepository,
  interviewQuestionPracticeRepository,
} from '@/lib/db/repositories/commercial.repository';

type QuestionRecord = {
  id: string;
  bankId: string;
  dimension: string;
  difficulty: string;
  questionType: string;
  prompt: string;
  referenceAnswer: string;
  rubric: unknown;
  keywords: unknown;
  followUpStrategy: unknown;
};

type AnswerInput = {
  questionId: string;
  answer: string;
};

type PracticeAttemptRecord = {
  id: string;
  bankId: string;
  questionId: string;
  metadata: unknown;
  score: number;
  isCorrect: boolean;
  feedback: string;
  rubricResult: unknown;
};

type PaperPracticeResult = {
  question: QuestionRecord;
  answer: string;
  evaluation: ReturnType<typeof scoreInterviewAnswer>;
  attempt: unknown;
  stats: unknown;
};

type DimensionEvaluation = {
  score: number;
  isCorrect: boolean;
  feedback: string;
  rubricResult: unknown;
};

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(/[\s,.;:，。；：、/\\|()[\]{}"'`]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
}

function scoreQuestionMatch(question: QuestionRecord, keywords: string[]) {
  const haystack = normalizeText([
    question.prompt,
    question.dimension,
    question.difficulty,
    question.questionType,
    question.referenceAnswer,
  ].join(' '));
  const keywordScore = keywords.reduce((score, keyword) => (
    haystack.includes(keyword) ? score + 5 : score
  ), 0);
  const difficultyScore = question.difficulty === 'medium' ? 2 : question.difficulty === 'hard' ? 1 : 0;
  return keywordScore + difficultyScore;
}

function summarizeDimensions(results: Array<{
  question: QuestionRecord;
  evaluation: DimensionEvaluation;
}>) {
  const byDimension = new Map<string, { total: number; count: number; weak: number }>();
  for (const item of results) {
    const key = item.question.dimension || 'general';
    const current = byDimension.get(key) || { total: 0, count: 0, weak: 0 };
    current.total += item.evaluation.score;
    current.count += 1;
    if (item.evaluation.score < 60) current.weak += 1;
    byDimension.set(key, current);
  }

  return Array.from(byDimension.entries()).map(([dimension, stat]) => ({
    dimension,
    score: Math.round(stat.total / Math.max(1, stat.count)),
    questionCount: stat.count,
    weakCount: stat.weak,
  })).sort((a, b) => a.score - b.score);
}

function buildPaperSummary(input: {
  averageScore: number;
  correctCount: number;
  total: number;
  dimensions: ReturnType<typeof summarizeDimensions>;
}) {
  const weakDimensions = input.dimensions.filter((item) => item.score < 70).slice(0, 3);
  const strengths = input.dimensions.filter((item) => item.score >= 75).slice(-3);
  return {
    summary: input.averageScore >= 75
      ? '整套练习表现较稳，建议继续补充真实项目细节和量化结果。'
      : input.averageScore >= 60
        ? '整体达到基础要求，但部分维度还需要补充结构化案例和关键术语。'
        : '当前回答覆盖不足，建议先按参考答案补齐核心概念，再进行第二轮练习。',
    strengths: strengths.map((item) => item.dimension),
    improvements: weakDimensions.map((item) => ({
      dimension: item.dimension,
      suggestion: '补充关键词、真实场景、取舍说明和可验证结果。',
    })),
    passRate: Math.round((input.correctCount / Math.max(1, input.total)) * 100),
  };
}

async function ensureBankAccess(input: {
  userId: string;
  bankId: string;
  legacyAiCredits?: number;
}) {
  const bank = await interviewQuestionBankRepository.findById(input.bankId);
  if (!bank || !bank.active) throw new Error('Question bank not found');
  const { product, access } = await ensureQuestionBankAccessPayload({
    userId: input.userId,
    bankId: bank.id,
    bankKey: bank.key,
    title: bank.title,
    description: bank.description,
    accessLevel: bank.accessLevel,
    legacyAiCredits: input.legacyAiCredits || 0,
  });

  if (access.planEntitled && !access.directEntitled) {
    await grantPlanQuestionBankEntitlement({
      userId: input.userId,
      bankId: bank.id,
      accessLevel: bank.accessLevel,
      product,
      title: bank.title,
      legacyAiCredits: input.legacyAiCredits || 0,
    });
  }

  if (!access.entitled) {
    const error = new Error('Payment required');
    error.name = 'ContentPaymentRequiredError';
    Object.assign(error, {
      product,
      freeDownloads: access.freeDownloads,
    });
    throw error;
  }
  return bank;
}

export async function generateInterviewPracticePaper(input: {
  userId: string;
  bankId: string;
  count?: number;
  targetRole?: string;
  jobDescription?: string;
  legacyAiCredits?: number;
}) {
  const bank = await ensureBankAccess(input);
  const questions = await interviewQuestionBankRepository.listQuestions(bank.id) as QuestionRecord[];
  const count = Math.min(20, Math.max(1, Math.floor(Number(input.count || 5))));
  const keywords = Array.from(new Set(tokenize(`${input.targetRole || ''} ${input.jobDescription || ''} ${bank.role} ${bank.level}`)));
  const recentAttempts = await interviewQuestionPracticeRepository.listAttemptsForUserAndBank(input.userId, bank.id, 100) as PracticeAttemptRecord[];
  const attemptedIds = new Set(recentAttempts.map((attempt) => attempt.questionId));

  const ranked = questions
    .map((question) => ({
      question,
      score: scoreQuestionMatch(question, keywords) + (attemptedIds.has(question.id) ? -3 : 0),
    }))
    .sort((a, b) => b.score - a.score);

  const selected = ranked.slice(0, count).map((item) => item.question);
  const paperId = `paper_${crypto.randomUUID()}`;
  return {
    paperId,
    bank: {
      id: bank.id,
      key: bank.key,
      title: bank.title,
      role: bank.role,
      level: bank.level,
      accessLevel: bank.accessLevel,
    },
    strategy: {
      mode: keywords.length ? 'jd_keyword_match' : 'bank_default',
      keywords: keywords.slice(0, 12),
      requestedCount: count,
      selectedCount: selected.length,
    },
    questions: selected.map((question) => ({
      id: question.id,
      bankId: question.bankId,
      dimension: question.dimension,
      difficulty: question.difficulty,
      questionType: question.questionType,
      prompt: question.prompt,
      followUpStrategy: parseJsonObject(question.followUpStrategy),
    })),
  };
}

export async function submitInterviewPracticePaper(input: {
  userId: string;
  bankId: string;
  paperId?: string;
  answers: AnswerInput[];
  targetRole?: string;
  jobDescription?: string;
  legacyAiCredits?: number;
  aiConfig?: AIConfig | null;
}) {
  const bank = await ensureBankAccess(input);
  const questions = await interviewQuestionBankRepository.listQuestions(bank.id) as QuestionRecord[];
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const paperId = input.paperId || `paper_${crypto.randomUUID()}`;
  const results: PaperPracticeResult[] = [];
  let aiScores: Awaited<ReturnType<typeof scoreInterviewAnswersWithAI>> | null = null;
  let aiScoreError: string | null = null;

  if (input.aiConfig) {
    try {
      aiScores = await scoreInterviewAnswersWithAI({
        userId: input.userId,
        aiConfig: input.aiConfig,
        bank: {
          id: bank.id,
          title: bank.title,
          role: bank.role,
          level: bank.level,
        },
        paperId,
        targetRole: input.targetRole,
        jobDescription: input.jobDescription,
        questions,
        answers: input.answers,
      });
    } catch (error) {
      aiScoreError = error instanceof Error ? error.message : 'AI scoring failed';
      console.warn('[interview-paper] AI scoring fallback:', aiScoreError);
    }
  }

  for (const item of input.answers) {
    const question = questionById.get(item.questionId);
    const answer = String(item.answer || '').trim();
    if (!question || !answer) continue;

    const baseline = scoreInterviewAnswer(question, answer);
    const evaluation = aiScores?.get(question.id) || baseline;
    const scoringMode = aiScores?.has(question.id) ? 'ai_rubric' : 'keyword_baseline';
    const recorded = await interviewQuestionPracticeRepository.recordAttempt({
      userId: input.userId,
      bankId: bank.id,
      questionId: question.id,
      answer,
      score: evaluation.score,
      isCorrect: evaluation.isCorrect,
      feedback: evaluation.feedback,
      rubricResult: evaluation.rubricResult,
      metadata: {
        mode: 'paper_practice',
        paperId,
        targetRole: input.targetRole || '',
        jobDescriptionPreview: (input.jobDescription || '').slice(0, 300),
        scoringMode,
        aiScoreError,
      },
    });
    results.push({
      question,
      answer,
      evaluation,
      attempt: recorded.attempt,
      stats: recorded.stats,
    });
  }

  const totalScore = results.reduce((sum, item) => sum + item.evaluation.score, 0);
  const correctCount = results.filter((item) => item.evaluation.isCorrect).length;
  const dimensions = summarizeDimensions(results);
  const averageScore = Math.round(totalScore / Math.max(1, results.length));
  const summary = buildPaperSummary({
    averageScore,
    correctCount,
    total: results.length,
    dimensions,
  });

  return {
    paperId,
    bank: {
      id: bank.id,
      key: bank.key,
      title: bank.title,
      role: bank.role,
      level: bank.level,
    },
    report: {
      averageScore,
      correctCount,
      total: results.length,
      dimensions,
      ...summary,
    },
    results: results.map((item) => ({
      question: {
        id: item.question.id,
        prompt: item.question.prompt,
        dimension: item.question.dimension,
        difficulty: item.question.difficulty,
        referenceAnswer: item.question.referenceAnswer,
      },
      answer: item.answer,
      evaluation: item.evaluation,
      attempt: item.attempt,
      stats: item.stats,
    })),
  };
}

export async function getInterviewPracticePaperReport(input: {
  userId: string;
  paperId: string;
}) {
  const attempts = await interviewQuestionPracticeRepository.listAttemptsForUser(input.userId, 200) as PracticeAttemptRecord[];
  const paperAttempts = attempts.filter((attempt) => parseJsonObject(attempt.metadata).paperId === input.paperId);
  const questions = await Promise.all(paperAttempts.map((attempt) => interviewQuestionBankRepository.findQuestionById(attempt.questionId)));
  const questionById = new Map(questions.filter(Boolean).map((question) => [question!.id, question as QuestionRecord]));
  const results = paperAttempts.map((attempt) => {
    const question = questionById.get(attempt.questionId);
    return {
      attempt,
      question,
      dimension: question?.dimension || 'general',
      score: Number(attempt.score || 0),
      isCorrect: Boolean(attempt.isCorrect),
      feedback: attempt.feedback,
      rubricResult: parseJsonObject(attempt.rubricResult),
    };
  });

  const totalScore = results.reduce((sum: number, item) => sum + item.score, 0);
  const correctCount = results.filter((item) => item.isCorrect).length;
  const dimensions = summarizeDimensions(results.map((item) => ({
    question: {
      id: item.question?.id || item.attempt.questionId,
      bankId: item.attempt.bankId,
      dimension: item.dimension,
      difficulty: item.question?.difficulty || 'medium',
      questionType: item.question?.questionType || 'open',
      prompt: item.question?.prompt || '',
      referenceAnswer: item.question?.referenceAnswer || '',
      rubric: item.question?.rubric || {},
      keywords: item.question?.keywords || [],
      followUpStrategy: item.question?.followUpStrategy || {},
    },
    evaluation: {
      score: item.score,
      isCorrect: item.isCorrect,
      feedback: item.feedback,
      rubricResult: item.rubricResult,
    },
  })));
  const averageScore = Math.round(totalScore / Math.max(1, results.length));

  return {
    paperId: input.paperId,
    report: {
      averageScore,
      correctCount,
      total: results.length,
      dimensions,
      ...buildPaperSummary({
        averageScore,
        correctCount,
        total: results.length,
        dimensions,
      }),
    },
    results,
  };
}
