import { WALLET_CURRENCY_AI_CREDIT } from './catalog';
import { entitlementValue } from './json';
import {
  membershipRepository,
  walletRepository,
} from '@/lib/db/repositories/commercial.repository';

export async function grantMembershipMonthlyAICredits(input: {
  userId: string;
  planId: string;
  planKey: string;
  source: string;
  sourceId?: string;
  membershipId?: string;
  currentPeriodStart?: Date | number | string | null;
}) {
  const periodKey = input.membershipId
    ? periodSourceId({
        membershipId: input.membershipId,
        currentPeriodStart: input.currentPeriodStart,
      })
    : '';
  const idempotencyKey = periodKey
    ? `${periodKey}:${input.source}:${input.sourceId || input.planId}:${input.planKey}`
    : input.sourceId
      ? `${input.source}:${input.sourceId}:${input.planKey}`
      : `${input.source}:${input.planId}:${input.planKey}`;
  const alreadyGranted = await walletRepository.hasTransaction(
    input.userId,
    'membership_monthly_credits',
    idempotencyKey,
  );
  if (alreadyGranted) return { granted: false, amount: 0 };

  const entitlements = await membershipRepository.listPlanEntitlements(input.planId);
  const monthlyCredits = entitlements.find((item: { key: string }) => item.key === 'ai.monthly_credits');
  const amount = Math.max(0, Math.floor(Number(entitlementValue(monthlyCredits?.value) || 0)));
  if (amount <= 0) return { granted: false, amount: 0 };

  await walletRepository.credit({
    userId: input.userId,
    currency: WALLET_CURRENCY_AI_CREDIT,
    amount,
    source: 'membership_monthly_credits',
    sourceId: idempotencyKey,
    description: `${input.planKey} 会员 AI 月额度`,
    metadata: {
      planId: input.planId,
      planKey: input.planKey,
      membershipId: input.membershipId,
      periodSourceId: periodKey || undefined,
      source: input.source,
      sourceId: input.sourceId,
    },
  });

  return { granted: true, amount };
}

function periodSourceId(input: {
  membershipId: string;
  currentPeriodStart?: Date | number | string | null;
}) {
  const start = input.currentPeriodStart ? new Date(input.currentPeriodStart).getTime() : 0;
  return `${input.membershipId}:${Number.isFinite(start) ? start : 0}`;
}

export async function syncActiveMembershipMonthlyAICredits(userId: string) {
  const activeMembership = await membershipRepository.getActiveMembership(userId);
  if (!activeMembership) return { granted: false, amount: 0, reason: 'no_active_membership' };
  if (activeMembership.membership.source !== 'system') {
    return { granted: false, amount: 0, reason: 'membership_credits_managed_by_source' };
  }

  return grantMembershipMonthlyAICredits({
    userId,
    planId: activeMembership.plan.id,
    planKey: activeMembership.plan.key,
    source: 'membership_period',
    membershipId: activeMembership.membership.id,
    currentPeriodStart: activeMembership.membership.currentPeriodStart,
  });
}
