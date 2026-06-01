import { NextResponse } from 'next/server';
import { ensureCommercialCatalog } from '@/lib/commercial/bootstrap';
import { membershipRepository } from '@/lib/db/repositories/commercial.repository';
import { membershipPlans } from '@/lib/db/schema';

type MembershipPlan = typeof membershipPlans.$inferSelect;

export async function GET() {
  try {
    await ensureCommercialCatalog();
    const plans = await membershipRepository.listPlans(true);
    const enriched = await Promise.all((plans as MembershipPlan[]).map(async (plan) => ({
      ...plan,
      entitlements: await membershipRepository.listPlanEntitlements(plan.id),
    })));
    return NextResponse.json({ plans: enriched });
  } catch (error) {
    console.error('GET /api/membership/plans error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
