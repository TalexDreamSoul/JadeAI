import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { confirmCommercialPayment } from '@/lib/commercial/payment-service';
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

    const order = await confirmCommercialPayment({
      userId: user.id,
      orderId,
      provider,
      rawPayload: body && typeof body === 'object' ? body : {},
    });
    if (order) {
      await recordProductEventSafely({
        eventName: 'payment_succeeded',
        userId: user.id,
        metadata: {
          orderId,
          provider,
          amountCents: Number(order.payableCents || 0),
          currency: String(order.currency || 'CNY').toUpperCase(),
        },
      });
    }
    return NextResponse.json(order);
  } catch (error) {
    console.error('POST /api/payments/confirm error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: message === 'Internal server error' ? 500 : 400 });
  }
}
