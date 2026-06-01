import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import {
  ensureQuestionBankAccessPayload,
  grantPlanQuestionBankEntitlement,
} from '@/lib/commercial/content-entitlement-service';
import {
  interviewQuestionBankRepository,
  interviewQuestionPracticeRepository,
} from '@/lib/db/repositories/commercial.repository';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bankId: string; questionId: string }> },
) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { bankId, questionId } = await params;
    const [bank, question] = await Promise.all([
      interviewQuestionBankRepository.findById(bankId),
      interviewQuestionBankRepository.findQuestionInBank(bankId, questionId),
    ]);
    if (!bank || !question) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { product, access } = await ensureQuestionBankAccessPayload({
      userId: user.id,
      bankId: bank.id,
      bankKey: bank.key,
      title: bank.title,
      description: bank.description,
      accessLevel: bank.accessLevel,
      legacyAiCredits: Number(user.aiCredits || 0),
    });
    if (access.planEntitled && !access.directEntitled) {
      await grantPlanQuestionBankEntitlement({
        userId: user.id,
        bankId: bank.id,
        accessLevel: bank.accessLevel,
        product,
        title: bank.title,
        legacyAiCredits: Number(user.aiCredits || 0),
      });
    }
    if (!access.entitled) {
      return NextResponse.json({
        error: 'Payment required',
        code: 'content_payment_required',
        product,
        freeDownloads: access.freeDownloads,
      }, { status: 402 });
    }

    const body = await request.json().catch(() => ({}));
    const result = await interviewQuestionPracticeRepository.setFavorite({
      userId: user.id,
      bankId,
      questionId,
      favorite: body.favorite !== false,
      source: String(body.source || 'manual'),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('POST /api/interview/question-banks/[bankId]/questions/[questionId]/favorite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
