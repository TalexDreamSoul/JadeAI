import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { entitlementRepository } from '@/lib/db/repositories/commercial.repository';
import { getUserEntitlementProfile } from '@/lib/commercial/entitlement-service';

export async function GET(request: NextRequest) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const resourceType = request.nextUrl.searchParams.get('resourceType');
    const resourceId = request.nextUrl.searchParams.get('resourceId');
    if (resourceType && resourceId) {
      const entitled = await entitlementRepository.hasResource(user.id, resourceType, resourceId);
      return NextResponse.json({ entitled });
    }

    const profile = await getUserEntitlementProfile(user.id, Number(user.aiCredits || 0));
    return NextResponse.json(profile);
  } catch (error) {
    console.error('GET /api/entitlements error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
