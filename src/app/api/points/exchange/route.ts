import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import {
  exchangePointsForBenefit,
  listPointsExchangeItems,
} from '@/lib/commercial/points-exchange-service';

export async function GET(request: NextRequest) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const result = await listPointsExchangeItems(user.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/points/exchange error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const result = await exchangePointsForBenefit({
      userId: user.id,
      itemId: String(body.itemId || ''),
      requestId: typeof body.requestId === 'string' ? body.requestId : undefined,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('POST /api/points/exchange error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: message === 'Internal server error' ? 500 : 400 });
  }
}
