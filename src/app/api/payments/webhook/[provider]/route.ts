import { NextRequest, NextResponse } from 'next/server';
import { handleCommercialPaymentWebhook } from '@/lib/commercial/payment-service';

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

    return NextResponse.json(result);
  } catch (error) {
    console.error('POST /api/payments/webhook/[provider] error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: message === 'Internal server error' ? 500 : 400 });
  }
}
