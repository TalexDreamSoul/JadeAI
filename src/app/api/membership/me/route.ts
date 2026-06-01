import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { getUserEntitlementProfile } from '@/lib/commercial/entitlement-service';

export async function GET(request: NextRequest) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const profile = await getUserEntitlementProfile(user.id, Number(user.aiCredits || 0));
    return NextResponse.json(profile);
  } catch (error) {
    console.error('GET /api/membership/me error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
