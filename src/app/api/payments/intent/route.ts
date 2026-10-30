import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { createCommercialPaymentIntent } from '@/lib/commercial/payment-service';
import { recordProductEventSafely } from '@/lib/analytics/product-event-service';

export async function POST(request: NextRequest) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const orderId = String(body.orderId || '');
    if (!orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    const provider = typeof body.provider === 'string' && body.provider.trim()
      ? body.provider.trim()
      : process.env.PAYMENT_PROVIDER?.trim();
    if (!provider) {
      return NextResponse.json({ error: 'Payment provider is not configured' }, { status: 503 });
    }

    const intent = await createCommercialPaymentIntent({
      userId: user.id,
      orderId,
      provider,
      returnUrl: typeof body.returnUrl === 'string' ? body.returnUrl : undefined,
      clientContext: body.clientContext && typeof body.clientContext === 'object' ? body.clientContext : {},
    });
    await recordProductEventSafely({
      eventName: 'checkout_started',
      userId: user.id,
      metadata: {
        orderId,
        provider: intent.provider,
        amountCents: intent.amountCents,
        currency: intent.currency.toUpperCase(),
      },
    });
    return NextResponse.json(intent, { status: 201 });
  } catch (error) {
    console.error('POST /api/payments/intent error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: message === 'Internal server error' ? 500 : 400 });
  }
}
