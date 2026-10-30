import { NextRequest, NextResponse } from 'next/server';
import {
  PaymentWebhookRequestError,
  handleCommercialPaymentWebhook,
} from '@/lib/commercial/payment-service';
import { recordProductEventSafely } from '@/lib/analytics/product-event-service';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    const { provider } = await params;
    const rawBody = await request.text();
    const result = await handleCommercialPaymentWebhook({
      provider,
      rawBody,
      headers: Object.fromEntries(request.headers.entries()),
    });

    const trackedResult = result as {
      status?: string;
      replayed?: boolean;
      order?: {
        id: string;
        userId: string;
        payableCents?: number;
        currency?: string;
      } | null;
    };
    if (trackedResult.status === 'succeeded' && !trackedResult.replayed && trackedResult.order) {
      await recordProductEventSafely({
        eventName: 'payment_succeeded',
        userId: trackedResult.order.userId,
        metadata: {
          orderId: trackedResult.order.id,
          provider,
          amountCents: Number(trackedResult.order.payableCents || 0),
          currency: String(trackedResult.order.currency || 'CNY').toUpperCase(),
        },
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('POST /api/payments/webhook/[provider] error:', error);
    if (error instanceof PaymentWebhookRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
