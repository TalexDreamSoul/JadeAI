import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { createCommercialOrder } from '@/lib/commercial/billing-service';
import { orderRepository } from '@/lib/db/repositories/commercial.repository';

export async function GET(request: NextRequest) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 50)));
    const orders = await orderRepository.listForUserDetailed(user.id, limit);
    return NextResponse.json({ orders });
  } catch (error) {
    console.error('GET /api/orders error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const items = Array.isArray(body.items) ? body.items : [];
    const order = await createCommercialOrder({
      userId: user.id,
      items,
      source: String(body.source || 'web'),
      metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
      legacyAiCredits: Number(user.aiCredits || 0),
    });
    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error('POST /api/orders error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: message === 'Internal server error' ? 500 : 400 });
  }
}
