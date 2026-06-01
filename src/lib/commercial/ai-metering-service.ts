import type { AIConfig } from '@/lib/ai/provider';
import type { LanguageModelUsage } from 'ai';
import {
  aiUsageRepository,
  membershipRepository,
  syncLegacyAICredits,
  walletRepository,
} from '@/lib/db/repositories/commercial.repository';
import { ensureUserCommercialDefaults } from './bootstrap';
import { WALLET_CURRENCY_AI_CREDIT } from './catalog';
import { inferAIModelTier } from './ai-model-tier-service';
import { entitlementValue } from './json';

type ChargeInput = {
  userId: string;
  feature: string;
  aiConfig?: Pick<AIConfig, 'provider' | 'model' | 'mode'>;
  credits?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  metadata?: Record<string, unknown>;
  legacyAiCredits?: number;
};

export type AIUsageReservation = {
  usageLogId: string;
  debitTransactionId: string;
  credits: number;
  userId: string;
  feature: string;
  metadata?: Record<string, unknown>;
};

export function usageToChargeFields(usage?: Partial<LanguageModelUsage> | null) {
  const promptTokens = Number(usage?.inputTokens || 0);
  const completionTokens = Number(usage?.outputTokens || 0);
  const totalTokens = Number(usage?.totalTokens || promptTokens + completionTokens || 0);
  return { promptTokens, completionTokens, totalTokens };
}

function normalizeCredits(credits?: number) {
  return Math.max(1, Math.floor(Number(credits || 1)));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'AI request failed');
}

async function getMembershipDeductionMetadata(userId: string) {
  const activeMembership = await membershipRepository.getActiveMembership(userId);
  if (!activeMembership) return null;

  const planEntitlements = await membershipRepository.listPlanEntitlements(activeMembership.plan.id);
  const monthlyCredits = planEntitlements.find((item: { key: string }) => item.key === 'ai.monthly_credits');

  return {
    membershipId: activeMembership.membership.id,
    planKey: activeMembership.plan.key,
    planName: activeMembership.plan.name,
    currentPeriodStart: activeMembership.membership.currentPeriodStart,
    currentPeriodEnd: activeMembership.membership.currentPeriodEnd,
    monthlyCredits: Math.max(0, Math.floor(Number(entitlementValue(monthlyCredits?.value) || 0))),
  };
}

async function withAIUsageAuditMetadata(input: ChargeInput) {
  const model = input.aiConfig?.model || '';
  return {
    ...(input.metadata || {}),
    ...(model
      ? {
          aiModelTier: {
            mode: input.aiConfig?.mode || 'custom',
            provider: input.aiConfig?.provider || '',
            model,
            requiredTier: inferAIModelTier(model),
          },
        }
      : {}),
    membershipDeduction: await getMembershipDeductionMetadata(input.userId),
  };
}

export async function hasAICredits(userId: string, legacyAiCredits = 0) {
  await ensureUserCommercialDefaults(userId, legacyAiCredits);
  const account = await walletRepository.ensureAccount(userId, WALLET_CURRENCY_AI_CREDIT, legacyAiCredits);
  return Number(account?.balance ?? legacyAiCredits) > 0;
}

export async function reserveAIUsage(input: ChargeInput): Promise<AIUsageReservation | null> {
  const credits = normalizeCredits(input.credits);
  await ensureUserCommercialDefaults(input.userId, input.legacyAiCredits || 0);
  const metadata = await withAIUsageAuditMetadata(input);

  const debit = await walletRepository.debit({
    userId: input.userId,
    currency: WALLET_CURRENCY_AI_CREDIT,
    amount: credits,
    source: 'ai_usage_reserve',
    description: input.feature,
    metadata,
  });

  if (!debit.ok) {
    await aiUsageRepository.record({
      userId: input.userId,
      feature: input.feature,
      provider: input.aiConfig?.provider,
      model: input.aiConfig?.model,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      totalTokens: input.totalTokens,
      creditsCharged: 0,
      status: 'insufficient_credits',
      error: 'AI credits exhausted',
      metadata,
    });
    return null;
  }

  const account = await walletRepository.findAccount(input.userId, WALLET_CURRENCY_AI_CREDIT);
  await syncLegacyAICredits(input.userId, Number(account?.balance || 0));
  const usageLogId = await aiUsageRepository.record({
    userId: input.userId,
    feature: input.feature,
    provider: input.aiConfig?.provider,
    model: input.aiConfig?.model,
    promptTokens: input.promptTokens,
    completionTokens: input.completionTokens,
    totalTokens: input.totalTokens,
    creditsCharged: credits,
    walletTransactionId: debit.transactionId,
    status: 'reserved',
    metadata: {
      ...metadata,
      reserveTransactionId: debit.transactionId,
    },
  });

  return {
    usageLogId,
    debitTransactionId: debit.transactionId,
    credits,
    userId: input.userId,
    feature: input.feature,
    metadata,
  };
}

export async function completeAIUsage(
  reservation: AIUsageReservation | null,
  usage?: Partial<LanguageModelUsage> | null,
  metadata?: Record<string, unknown>
) {
  if (!reservation) return false;
  const usageFields = usageToChargeFields(usage);
  await aiUsageRepository.update(reservation.usageLogId, {
    ...usageFields,
    status: 'success',
    error: null,
    metadata: {
      ...(reservation.metadata || {}),
      ...(metadata || {}),
      reserveTransactionId: reservation.debitTransactionId,
    },
  });
  return true;
}

export async function refundAIUsage(
  reservation: AIUsageReservation | null,
  error: unknown,
  metadata?: Record<string, unknown>
) {
  if (!reservation) return false;
  const refund = await walletRepository.credit({
    userId: reservation.userId,
    currency: WALLET_CURRENCY_AI_CREDIT,
    amount: reservation.credits,
    source: 'ai_usage_refund',
    sourceId: reservation.usageLogId,
    description: `${reservation.feature} 失败退款`,
    metadata: {
      ...(reservation.metadata || {}),
      ...(metadata || {}),
      reserveTransactionId: reservation.debitTransactionId,
    },
  });
  const account = await walletRepository.findAccount(reservation.userId, WALLET_CURRENCY_AI_CREDIT);
  await syncLegacyAICredits(reservation.userId, Number(account?.balance || 0));
  await aiUsageRepository.update(reservation.usageLogId, {
    creditsCharged: 0,
    status: 'failed_refunded',
    error: getErrorMessage(error),
    metadata: {
      ...(reservation.metadata || {}),
      ...(metadata || {}),
      reserveTransactionId: reservation.debitTransactionId,
      refundTransactionId: refund.transactionId,
    },
  });
  return true;
}

export async function chargeAIUsage(input: ChargeInput) {
  const credits = normalizeCredits(input.credits);
  await ensureUserCommercialDefaults(input.userId, input.legacyAiCredits || 0);
  const metadata = await withAIUsageAuditMetadata(input);

  const debit = await walletRepository.debit({
    userId: input.userId,
    currency: WALLET_CURRENCY_AI_CREDIT,
    amount: credits,
    source: 'ai_usage',
    description: input.feature,
    metadata,
  });

  if (!debit.ok) {
    await aiUsageRepository.record({
      userId: input.userId,
      feature: input.feature,
      provider: input.aiConfig?.provider,
      model: input.aiConfig?.model,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      totalTokens: input.totalTokens,
      creditsCharged: 0,
      status: 'insufficient_credits',
      error: 'AI credits exhausted',
      metadata,
    });
    return false;
  }

  const account = await walletRepository.findAccount(input.userId, WALLET_CURRENCY_AI_CREDIT);
  await syncLegacyAICredits(input.userId, Number(account?.balance || 0));
  await aiUsageRepository.record({
    userId: input.userId,
    feature: input.feature,
    provider: input.aiConfig?.provider,
    model: input.aiConfig?.model,
    promptTokens: input.promptTokens,
    completionTokens: input.completionTokens,
    totalTokens: input.totalTokens,
    creditsCharged: credits,
    walletTransactionId: debit.transactionId,
    status: 'success',
    metadata,
  });
  return true;
}

export async function chargeLegacyCompatibleAIUsage(input: ChargeInput) {
  return chargeAIUsage(input);
}
