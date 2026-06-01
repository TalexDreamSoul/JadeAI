import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { cancelCommercialOrder } from '@/lib/commercial/billing-service';
import { orderRepository } from '@/lib/db/repositories/commercial.repository';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const order = await orderRepository.findByIdForUser(id, user.id);
    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(order);
  } catch (error) {
    console.error('GET /api/orders/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || '');
    if (action !== 'cancel') return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });

    const order = await cancelCommercialOrder({
      userId: user.id,
      orderId: id,
      reason: typeof body.reason === 'string' ? body.reason : undefined,
    });
    return NextResponse.json(order);
  } catch (error) {
    console.error('PATCH /api/orders/[id] error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: message === 'Internal server error' ? 500 : 400 });
  }
}
