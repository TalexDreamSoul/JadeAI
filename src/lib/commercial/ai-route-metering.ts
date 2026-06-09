import type { LanguageModelUsage } from 'ai';
import type { AIConfig } from '@/lib/ai/provider';
import { userRepository } from '@/lib/db/repositories/user.repository';
import { completeAIUsage, refundAIUsage } from './ai-metering-service';

export class AIUsageInsufficientCreditsError extends Error {
  constructor(message = 'AI credits exhausted') {
    super(message);
    this.name = 'AIUsageInsufficientCreditsError';
  }
}

export async function withMeteredAIUsage<T>(input: {
  userId?: string | null;
  aiConfig: Pick<AIConfig, 'provider' | 'model' | 'mode' | 'userId'>;
  feature: string;
  credits?: number;
  metadata?: Record<string, unknown>;
  run: () => Promise<{
    value: T;
    usage?: Partial<LanguageModelUsage> | null;
    metadata?: Record<string, unknown>;
  }>;
}) {
  const userId = input.userId || input.aiConfig.userId;

  if (!userId || input.aiConfig.mode !== 'server') {
    const output = await input.run();
    return output.value;
  }

  const reserved = await userRepository.reserveAICredit(userId, {
    feature: input.feature,
    aiConfig: input.aiConfig,
    credits: input.credits,
    metadata: input.metadata,
  });
  if (!reserved.ok) {
    throw new AIUsageInsufficientCreditsError(reserved.error);
  }

  try {
    const output = await input.run();
    await completeAIUsage(reserved.reservation, output.usage, {
      ...(input.metadata || {}),
      ...(output.metadata || {}),
    });
    return output.value;
  } catch (error) {
    await refundAIUsage(reserved.reservation, error, input.metadata).catch((refundError) => {
      console.error('[ai-metering] refund failed:', refundError);
    });
    throw error;
  }
}
