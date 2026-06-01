import {
  entitlementRepository,
  membershipRepository,
  notificationStoreRepository,
  walletRepository,
} from '@/lib/db/repositories/commercial.repository';
import { grantMembershipMonthlyAICredits } from './membership-credit-service';

type BenefitItem = {
  type?: unknown;
  planKey?: unknown;
  durationDays?: unknown;
  currency?: unknown;
  amount?: unknown;
  key?: unknown;
  value?: unknown;
  resourceType?: unknown;
  resourceId?: unknown;
  expiresInDays?: unknown;
  title?: unknown;
  description?: unknown;
};

type GrantBenefitInput = {
  userId: string;
  benefit: unknown;
  source: string;
  sourceId?: string;
};

function benefitItems(benefit: unknown): BenefitItem[] {
  if (Array.isArray(benefit)) return benefit as BenefitItem[];
  if (benefit && typeof benefit === 'object') {
    const record = benefit as Record<string, unknown>;
    return Array.isArray(record.items) ? record.items as BenefitItem[] : [record as BenefitItem];
  }
  return [];
}

function optionalDateFromDays(days: unknown) {
  const normalized = Math.floor(Number(days || 0));
  if (normalized <= 0) return null;
  const date = new Date();
  date.setDate(date.getDate() + normalized);
  return date;
}

function itemSourceId(sourceId: string | undefined, index: number, type: string) {
  return sourceId ? `${sourceId}:item:${index}:${type}` : undefined;
}

export async function grantCommercialBenefits(input: GrantBenefitInput) {
  const granted: Array<Record<string, unknown>> = [];

  for (const [index, item] of benefitItems(input.benefit).entries()) {
    const type = String(item.type || '');
    const sourceId = itemSourceId(input.sourceId, index, type);

    if (type === 'membership') {
      const planKey = String(item.planKey || '');
      if (!planKey) continue;
      const existingMembership = sourceId
        ? await membershipRepository.findMembershipBySource(input.userId, input.source, sourceId)
        : null;
      if (existingMembership) {
        granted.push({
          type,
          planKey,
          membershipId: existingMembership.membership.id,
          skipped: true,
          reason: 'already_granted',
          sourceId,
        });
        continue;
      }
      const membership = await membershipRepository.grantMembership({
        userId: input.userId,
        planKey,
        source: input.source,
        sourceId,
        durationDays: Math.max(1, Math.floor(Number(item.durationDays || 31))),
      });
      const membershipBelongsToBenefit = membership?.membership.source === input.source
        && (!sourceId || membership.membership.sourceId === sourceId);
      if (membership?.plan && membershipBelongsToBenefit) {
        await grantMembershipMonthlyAICredits({
          userId: input.userId,
          planId: membership.plan.id,
          planKey: membership.plan.key,
          source: input.source,
          sourceId,
          membershipId: membership.membership.id,
          currentPeriodStart: membership.membership.currentPeriodStart,
        });
        granted.push({ type, planKey, membershipId: membership.membership.id, sourceId });
      } else {
        granted.push({ type, planKey, skipped: true, reason: 'membership_not_replaced', sourceId });
      }
      continue;
    }

    if (type === 'wallet') {
      const currency = String(item.currency || '');
      const amount = Math.max(0, Math.floor(Number(item.amount || 0)));
      if (!currency || amount <= 0) continue;
      const alreadyGranted = sourceId
        ? await walletRepository.hasTransaction(input.userId, input.source, sourceId)
        : false;
      if (alreadyGranted) {
        granted.push({ type, currency, amount, skipped: true, reason: 'already_granted', sourceId });
        continue;
      }
      await walletRepository.credit({
        userId: input.userId,
        currency,
        amount,
        source: input.source,
        sourceId,
        description: String(item.description || '福利到账'),
      });
      granted.push({ type, currency, amount, sourceId });
      continue;
    }

    if (type === 'entitlement') {
      const key = String(item.key || '');
      if (!key) continue;
      const resourceType = item.resourceType ? String(item.resourceType) : null;
      const resourceId = item.resourceId ? String(item.resourceId) : null;
      const alreadyGranted = resourceType && resourceId
        ? await entitlementRepository.hasResource(input.userId, resourceType, resourceId)
        : sourceId
          ? await entitlementRepository.findBySource(input.userId, input.source, sourceId, key)
          : null;
      if (alreadyGranted) {
        granted.push({ type, key, skipped: true, reason: 'already_granted', sourceId });
        continue;
      }
      const entitlement = await entitlementRepository.grant({
        userId: input.userId,
        key,
        value: item.value ?? true,
        resourceType,
        resourceId,
        source: input.source,
        sourceId,
        expiresAt: optionalDateFromDays(item.expiresInDays),
      });
      granted.push({ type, entitlementId: entitlement?.id, key, sourceId });
      continue;
    }

    if (type === 'notification') {
      if (sourceId && await notificationStoreRepository.hasSource(input.userId, input.source, sourceId)) {
        granted.push({ type, skipped: true, reason: 'already_granted', sourceId });
        continue;
      }
      const id = await notificationStoreRepository.create({
        userId: input.userId,
        type: input.source,
        title: String(item.title || '福利已到账'),
        description: String(item.description || ''),
        metadata: { sourceId },
      });
      granted.push({ type, notificationId: id, sourceId });
    }
  }

  return granted;
}
