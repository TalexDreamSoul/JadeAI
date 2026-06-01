import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { confirmCommercialPayment } from '@/lib/commercial/payment-service';

export async function POST(request: NextRequest) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const orderId = String(body.orderId || '');
    if (!orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 });

    const order = await confirmCommercialPayment({
      userId: user.id,
      orderId,
      provider: 'mock',
      rawPayload: body,
    });
    return NextResponse.json(order);
  } catch (error) {
    console.error('POST /api/payments/mock/confirm error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: message === 'Internal server error' ? 500 : 400 });
  }
}
