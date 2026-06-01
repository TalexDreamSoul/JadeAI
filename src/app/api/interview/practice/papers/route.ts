import { NextRequest, NextResponse } from 'next/server';
import { AIConfigError, extractAIConfig } from '@/lib/ai/provider';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import {
  generateInterviewPracticePaper,
  submitInterviewPracticePaper,
} from '@/lib/commercial/interview-paper-service';

type PaperAnswerPayload = {
  questionId?: unknown;
  answer?: unknown;
};

type PaymentRequiredError = Error & {
  product?: unknown;
  freeDownloads?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const bankId = String(body.bankId || '');
    if (!bankId) return NextResponse.json({ error: 'bankId is required' }, { status: 400 });

    const action = String(body.action || 'generate');
    if (action === 'submit') {
      const answers = Array.isArray(body.answers) ? body.answers : [];
      if (!answers.length) return NextResponse.json({ error: 'answers are required' }, { status: 400 });
      const aiConfig = await extractAIConfig(request).catch((error) => {
        if (error instanceof AIConfigError) return null;
        throw error;
      });

      const result = await submitInterviewPracticePaper({
        userId: user.id,
        bankId,
        paperId: typeof body.paperId === 'string' ? body.paperId : undefined,
        answers: (answers as PaperAnswerPayload[]).map((item) => ({
          questionId: String(item?.questionId || ''),
          answer: String(item?.answer || ''),
        })),
        targetRole: typeof body.targetRole === 'string' ? body.targetRole : undefined,
        jobDescription: typeof body.jobDescription === 'string' ? body.jobDescription : undefined,
        legacyAiCredits: Number(user.aiCredits || 0),
        aiConfig,
      });
      return NextResponse.json(result, { status: 201 });
    }

    const paper = await generateInterviewPracticePaper({
      userId: user.id,
      bankId,
      count: Number(body.count || 5),
      targetRole: typeof body.targetRole === 'string' ? body.targetRole : undefined,
      jobDescription: typeof body.jobDescription === 'string' ? body.jobDescription : undefined,
      legacyAiCredits: Number(user.aiCredits || 0),
    });
    return NextResponse.json(paper, { status: 201 });
  } catch (error) {
    console.error('POST /api/interview/practice/papers error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = error instanceof Error && error.name === 'ContentPaymentRequiredError'
      ? 402
      : message === 'Internal server error'
        ? 500
        : 400;
    return NextResponse.json({
      error: message,
      ...(status === 402
        ? {
            code: 'content_payment_required',
            product: (error as PaymentRequiredError).product,
            freeDownloads: (error as PaymentRequiredError).freeDownloads,
          }
        : {}),
    }, { status });
  }
}
