import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import {
  interviewQuestionBankRepository,
  interviewQuestionPracticeRepository,
} from '@/lib/db/repositories/commercial.repository';

type QuestionPracticeRef = {
  questionId: string;
};

type WrongQuestionStat = QuestionPracticeRef & {
  [key: string]: unknown;
};

export async function GET(request: NextRequest) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 50)));
    const bankId = request.nextUrl.searchParams.get('bankId') || undefined;
    const [attempts, favorites, wrongStats] = await Promise.all([
      interviewQuestionPracticeRepository.listAttemptsForUser(user.id, limit),
      interviewQuestionPracticeRepository.listFavorites(user.id, bankId),
      interviewQuestionPracticeRepository.listWrongStats(user.id, limit),
    ]);

    const questionIds = Array.from(new Set([
      ...(attempts as QuestionPracticeRef[]).map((item) => item.questionId),
      ...(favorites as QuestionPracticeRef[]).map((item) => item.questionId),
      ...(wrongStats as QuestionPracticeRef[]).map((item) => item.questionId),
    ]));
    const questions = await Promise.all(questionIds.map((id) => interviewQuestionBankRepository.findQuestionById(id)));
    const questionById = new Map(questions.filter(Boolean).map((question) => [question!.id, question]));

    return NextResponse.json({
      attempts,
      favorites,
      wrongQuestions: (wrongStats as WrongQuestionStat[]).map((stat) => ({
        ...stat,
        question: questionById.get(stat.questionId) || null,
      })),
    });
  } catch (error) {
    console.error('GET /api/interview/practice error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
