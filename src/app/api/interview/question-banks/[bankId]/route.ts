import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import {
  ensureQuestionBankAccessPayload,
  grantPlanQuestionBankEntitlement,
} from '@/lib/commercial/content-entitlement-service';
import { interviewQuestionBankRepository } from '@/lib/db/repositories/commercial.repository';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bankId: string }> },
) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { bankId } = await params;
    const bank = await interviewQuestionBankRepository.findById(bankId);
    if (!bank || !bank.active) return NextResponse.json({ error: 'Not found' }, { status: 404 });

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

    const questions = await interviewQuestionBankRepository.listQuestions(bank.id);
    return NextResponse.json({
      ...bank,
      product,
      unlocked: true,
      questions,
    });
  } catch (error) {
    console.error('GET /api/interview/question-banks/[bankId] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
