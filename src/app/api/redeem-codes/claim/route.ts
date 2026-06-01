import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { claimRedeemCode } from '@/lib/commercial/redeem-service';

export async function POST(request: NextRequest) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const result = await claimRedeemCode({
      userId: user.id,
      code: String(body.code || ''),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('POST /api/redeem-codes/claim error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: message === 'Internal server error' ? 500 : 400 });
  }
}
