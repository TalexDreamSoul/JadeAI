import { entitlementValue, parseJsonObject } from './json';
import { ensureUserCommercialDefaults } from './bootstrap';
import {
  entitlementRepository,
  membershipRepository,
} from '@/lib/db/repositories/commercial.repository';

export const ACCESS_LEVEL_RANK: Record<string, number> = {
  free: 0,
  pro: 10,
  premium: 20,
  business: 30,
};

export function canEntitlementLevelAccess(
  entitlements: Record<string, unknown>,
  entitlementKey: string,
  requiredLevel: string,
) {
  const level = String(entitlements[entitlementKey] || 'free');
  return (ACCESS_LEVEL_RANK[level] ?? 0) >= (ACCESS_LEVEL_RANK[requiredLevel] ?? 0);
}

export async function getUserEntitlementProfile(userId: string, legacyAiCredits = 0) {
  await ensureUserCommercialDefaults(userId, legacyAiCredits);
  const [membership, directEntitlements] = await Promise.all([
    membershipRepository.getActiveMembership(userId),
    entitlementRepository.listForUser(userId),
  ]);

  const planEntitlements = membership
    ? await membershipRepository.listPlanEntitlements(membership.plan.id)
    : [];

  const entitlements: Record<string, unknown> = {};
  for (const item of planEntitlements) {
    entitlements[item.key] = entitlementValue(item.value);
  }
  for (const item of directEntitlements) {
    if (!item.resourceType && !item.resourceId) {
      entitlements[item.key] = entitlementValue(item.value);
    }
  }

  return {
    membership,
    entitlements,
    directEntitlements,
  };
}

export async function canAccessEntitlement(userId: string, key: string, legacyAiCredits = 0) {
  const profile = await getUserEntitlementProfile(userId, legacyAiCredits);
  return Boolean(profile.entitlements[key]);
}

export async function canAccessQuestionBank(userId: string, bank: { id: string; accessLevel: string }, legacyAiCredits = 0) {
  const profile = await getUserEntitlementProfile(userId, legacyAiCredits);
  const hasLevel = canEntitlementLevelAccess(
    profile.entitlements,
    'interview.question_bank.access_level',
    bank.accessLevel,
  );
  if (hasLevel) return true;
  return entitlementRepository.hasResource(userId, 'interview_question_bank', bank.id);
}

export function getNumericEntitlement(profile: { entitlements: Record<string, unknown> }, key: string, fallback = 0) {
  const value = profile.entitlements[key];
  return typeof value === 'number' ? value : Number(value ?? fallback) || fallback;
}

export function normalizeEntitlementMap(values: unknown) {
  return parseJsonObject(values);
}
