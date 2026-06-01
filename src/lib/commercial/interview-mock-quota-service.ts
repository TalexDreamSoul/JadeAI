import { getNumericEntitlement, getUserEntitlementProfile } from './entitlement-service';
import { entitlementValue } from './json';
import { interviewRepository } from '@/lib/db/repositories/interview.repository';

type MembershipProfileLike = {
  membership?: {
    membership?: {
      currentPeriodStart?: Date | number | string | null;
    } | null;
  } | null;
  entitlements: Record<string, unknown>;
  directEntitlements: Array<{
    id?: string;
    key: string;
    value: unknown;
    source?: string | null;
    sourceId?: string | null;
    startsAt?: Date | number | string | null;
    expiresAt?: Date | number | string | null;
    createdAt?: Date | number | string | null;
  }>;
};

type ExtraMockEntitlement = {
  id?: string;
  count: number;
  source?: string | null;
  sourceId?: string | null;
  startsAt: Date;
  expiresAt: Date | null;
};

export class InterviewMockQuotaExceededError extends Error {
  status = 402;
  code = 'interview_mock_quota_exceeded';
  details: Record<string, unknown>;

  constructor(details: Record<string, unknown>) {
    super('当前会员模拟面试次数已用完，请升级会员或购买模拟面试包。');
    this.name = 'InterviewMockQuotaExceededError';
    this.details = details;
  }
}

function periodStart(profile: MembershipProfileLike) {
  const value = profile.membership?.membership?.currentPeriodStart;
  const date = value ? new Date(value) : new Date();
  date.setHours(0, 0, 0, 0);
  return Number.isFinite(date.getTime()) ? date : new Date();
}

function numericEntitlementValue(value: unknown) {
  const unwrapped = entitlementValue(value);
  return typeof unwrapped === 'number' ? unwrapped : Number(unwrapped || 0) || 0;
}

function normalizedDate(value: Date | number | string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function laterDate(left: Date, right: Date) {
  return left.getTime() >= right.getTime() ? left : right;
}

function earlierDate(left: Date, right: Date) {
  return left.getTime() <= right.getTime() ? left : right;
}

function extraMockEntitlements(profile: MembershipProfileLike): ExtraMockEntitlement[] {
  return profile.directEntitlements
    .filter((item) => item.key === 'interview.mock.extra_count')
    .map((item) => {
      const count = numericEntitlementValue(item.value);
      const startsAt = normalizedDate(item.startsAt) || normalizedDate(item.createdAt) || new Date();
      return {
        id: item.id,
        count,
        source: item.source,
        sourceId: item.sourceId,
        startsAt,
        expiresAt: normalizedDate(item.expiresAt),
      };
    })
    .filter((item) => item.count > 0)
    .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());
}

function groupExtraEntitlementsByStart(start: Date, entitlements: ExtraMockEntitlement[]) {
  const groups = new Map<string, { startsAt: Date; count: number }>();
  for (const item of entitlements) {
    const startsAt = laterDate(start, item.startsAt);
    const key = startsAt.toISOString();
    const existing = groups.get(key);
    groups.set(key, {
      startsAt,
      count: (existing?.count || 0) + item.count,
    });
  }
  return Array.from(groups.values()).sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());
}

export async function getInterviewMockQuota(userId: string, legacyAiCredits = 0) {
  const profile = await getUserEntitlementProfile(userId, legacyAiCredits) as MembershipProfileLike;
  const start = periodStart(profile);
  const monthly = getNumericEntitlement(profile, 'interview.mock.monthly_count', 1);
  const extraEntitlements = extraMockEntitlements(profile);
  const extra = extraEntitlements.reduce((sum, item) => sum + item.count, 0);
  const earliestExtraStart = extraEntitlements[0]?.startsAt;
  const extraWindowStart = earliestExtraStart ? laterDate(start, earliestExtraStart) : null;
  const used = await interviewRepository.countSessionsForUserSince(userId, start);
  const extraGroups = groupExtraEntitlementsByStart(start, extraEntitlements);
  const extraWindowUsage = new Map<string, number>();
  await Promise.all(extraGroups.map(async ({ startsAt }) => {
    extraWindowUsage.set(
      startsAt.toISOString(),
      await interviewRepository.countSessionsForUserSince(userId, startsAt),
    );
  }));
  const extraWindowUsed = extraWindowStart
    ? extraWindowUsage.get(extraWindowStart.toISOString()) ?? 0
    : 0;
  const usedBeforeExtraWindow = Math.max(0, used - extraWindowUsed);
  const monthlyUsedBeforeExtraWindow = Math.min(monthly, usedBeforeExtraWindow);
  const monthlyAvailableInExtraWindow = Math.max(0, monthly - monthlyUsedBeforeExtraWindow);
  const monthlyUsedInExtraWindow = Math.min(extraWindowUsed, monthlyAvailableInExtraWindow);
  const monthlyUsed = extraWindowStart
    ? monthlyUsedBeforeExtraWindow + monthlyUsedInExtraWindow
    : Math.min(monthly, used);
  let extraUsed = 0;
  let priorExtraCapacity = 0;
  for (const group of extraGroups) {
    const groupWindowUsed = extraWindowUsage.get(group.startsAt.toISOString()) ?? 0;
    const monthlyBeforeGroupWindow = Math.min(monthly, Math.max(0, used - groupWindowUsed));
    const monthlyInGroupWindow = Math.min(groupWindowUsed, Math.max(0, monthly - monthlyBeforeGroupWindow));
    const extraDemandSinceGroupStart = Math.max(0, groupWindowUsed - monthlyInGroupWindow - priorExtraCapacity);
    extraUsed += Math.min(group.count, extraDemandSinceGroupStart);
    priorExtraCapacity += group.count;
  }
  const monthlyRemaining = Math.max(0, monthly - monthlyUsed);
  const extraRemaining = Math.max(0, extra - extraUsed);
  const limit = monthly + extra;
  const firstExtraExpiresAt = extraEntitlements
    .reduce<Date | null>((earliest, item) => (
      item.expiresAt ? (earliest ? earlierDate(earliest, item.expiresAt) : item.expiresAt) : earliest
    ), null);

  return {
    monthly,
    extra,
    limit,
    used,
    remaining: monthlyRemaining + extraRemaining,
    monthlyUsed,
    monthlyRemaining,
    extraUsed,
    extraRemaining,
    periodStart: start.toISOString(),
    extraWindowStart: extraWindowStart?.toISOString() ?? null,
    extraExpiresAt: firstExtraExpiresAt?.toISOString() ?? null,
    extraEntitlements: extraEntitlements.map((item) => ({
      id: item.id,
      count: item.count,
      source: item.source,
      sourceId: item.sourceId,
      startsAt: item.startsAt.toISOString(),
      expiresAt: item.expiresAt?.toISOString() ?? null,
    })),
  };
}

export async function assertCanCreateInterviewMock(userId: string, legacyAiCredits = 0) {
  const quota = await getInterviewMockQuota(userId, legacyAiCredits);
  if (quota.limit > 0 && quota.remaining <= 0) {
    throw new InterviewMockQuotaExceededError(quota);
  }
  return quota;
}

export function interviewMockQuotaExceededResponse(error: InterviewMockQuotaExceededError) {
  return Response.json({
    error: error.message,
    code: error.code,
    ...error.details,
  }, { status: error.status });
}
