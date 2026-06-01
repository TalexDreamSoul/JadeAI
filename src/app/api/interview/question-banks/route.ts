import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { ensureCommercialCatalog } from '@/lib/commercial/bootstrap';
import { ensureQuestionBankAccessPayload } from '@/lib/commercial/content-entitlement-service';
import { interviewQuestionBankRepository } from '@/lib/db/repositories/commercial.repository';
import { interviewQuestionBanks } from '@/lib/db/schema';

type InterviewQuestionBank = typeof interviewQuestionBanks.$inferSelect;

export async function GET(request: NextRequest) {
  try {
    await ensureCommercialCatalog();
    const user = await resolveUser(getUserIdFromRequest(request)).catch(() => null);
    const includeQuestions = request.nextUrl.searchParams.get('includeQuestions') === '1';
    const banks = await interviewQuestionBankRepository.list(true);

    const result = await Promise.all((banks as InterviewQuestionBank[]).map(async (bank) => {
      const payload = user
        ? await ensureQuestionBankAccessPayload({
            userId: user.id,
            bankId: bank.id,
            bankKey: bank.key,
            title: bank.title,
            description: bank.description,
            accessLevel: bank.accessLevel,
            legacyAiCredits: Number(user.aiCredits || 0),
          })
        : null;
      const unlocked = payload?.access.entitled ?? bank.accessLevel === 'free';
      const questions = includeQuestions && unlocked
        ? await interviewQuestionBankRepository.listQuestions(bank.id)
        : undefined;
      return {
        ...bank,
        unlocked,
        questions,
        product: payload?.product || null,
        freeDownloads: payload?.access.freeDownloads || null,
        canUseMonthlyFreeDownload: payload?.access.canUseMonthlyFreeDownload || false,
      };
    }));

    return NextResponse.json({ banks: result });
  } catch (error) {
    console.error('GET /api/interview/question-banks error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
