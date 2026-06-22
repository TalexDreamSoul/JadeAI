import { NextRequest } from 'next/server';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';
import { auth } from '@/lib/auth/config';
import { config } from '@/lib/config';
import { dbReady } from '@/lib/db';
import { userRepository } from '@/lib/db/repositories/user.repository';
import { selectServerAIConfig, type OpenAIEndpoint } from './server-config';
import { hasAICredits } from '@/lib/commercial/ai-metering-service';
import { getServerAIModelAccess } from '@/lib/commercial/ai-model-tier-service';

export interface AIConfig {
  provider: string;
  apiKey: string;
  baseURL: string;
  model: string;
  mode: 'server' | 'custom';
  openAIEndpoint: OpenAIEndpoint;
  userId?: string;
}

export async function resolveAIRequestUser(request: NextRequest) {
  await dbReady;
  const fingerprint = request.headers.get('x-fingerprint');
  if (!config.auth.enabled && fingerprint) {
    return userRepository.upsertByFingerprint(fingerprint);
  }

  const session = await auth();
  if (session?.user?.id && session.user.email) {
    const user = await userRepository.findById(session.user.id);
    if (user) return user;
    return userRepository.findByEmail(session.user.email);
  }

  return null;
}

export async function extractAIConfig(request: NextRequest): Promise<AIConfig> {
  const user = await resolveAIRequestUser(request);
  if (!user) {
    throw new AIConfigError('Please log in to use the cloud AI service.');
  }
  return resolveServerAIConfigForUser(user);
}

export async function resolveServerAIConfigForUser(user: { id: string; role?: string | null; aiCredits?: unknown }): Promise<AIConfig> {
  if (user.role !== 'admin' && !await hasAICredits(user.id, Number(user.aiCredits || 0))) {
    throw new AIConfigError('AI credits exhausted. Please contact an administrator or upgrade your plan.');
  }

  const serverConfig = await selectServerAIConfig();
  if (serverConfig.apiKey) {
    await assertAIModelAllowed(user, serverConfig.model);
    return { ...serverConfig, mode: 'server', userId: user.id };
  }

  throw new AIConfigError('Cloud AI is not configured. Please ask an administrator to configure an AI channel.');
}

export function extractAIConfigSync(): AIConfig {
  throw new AIConfigError('Cloud AI requests must be resolved asynchronously for user and quota checks.');
}

export async function resolveAllowedAIModelId(
  request: NextRequest,
  config: AIConfig,
  modelOverride?: unknown
): Promise<string> {
  const modelId = typeof modelOverride === 'string' && modelOverride.trim()
    ? modelOverride.trim()
    : config.model;

  if (modelId === config.model) return modelId;

  const user = await resolveAIRequestUser(request);
  if (!user) {
    throw new AIConfigError('Please log in to use the cloud AI service.');
  }

  await assertAIModelAllowed(user, modelId);

  return modelId;
}

async function assertAIModelAllowed(user: { id: string; role?: string | null; aiCredits?: unknown }, model: string) {
  if (user.role === 'admin') return;

  const access = await getServerAIModelAccess({
    userId: user.id,
    model,
    legacyAiCredits: Number(user.aiCredits || 0),
  });

  if (!access.allowed) {
    throw new AIConfigError(`当前会员仅支持 ${access.allowedTier} 模型等级，请升级会员后使用 ${access.requiredTier} 模型。`);
  }
}

export function getModel(config: AIConfig, modelId = config.model): LanguageModel {
  if (!config.apiKey) {
    throw new AIConfigError(
      config.mode === 'server'
        ? 'Cloud AI is not configured. Please ask an administrator to configure an AI channel.'
        : 'Personal API keys are disabled. Please use the cloud AI service.'
    );
  }

  switch (config.provider) {
    case 'anthropic': {
      const p = createAnthropic({ apiKey: config.apiKey, baseURL: config.baseURL || undefined });
      return p(modelId);
    }
    case 'gemini': {
      const p = createGoogleGenerativeAI({ apiKey: config.apiKey, baseURL: config.baseURL || undefined });
      return p(modelId);
    }
    default: {
      const p = createOpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
      return config.openAIEndpoint === 'responses' ? p.responses(modelId) : p.chat(modelId);
    }
  }
}

/**
 * Returns providerOptions for OpenAI / OpenAI-compatible endpoints.
 * JSON response format is handled via AI SDK `Output.json()` / `Output.object()`.
 */
export function getProviderOptions(config: AIConfig) {
  if (config.provider !== 'openai') return {} as Record<string, never>;
  if (config.openAIEndpoint !== 'responses') return {} as Record<string, never>;

  return {
    openai: {
      // Responses API stores generations by default; keep TouchResume calls stateless.
      store: false,
    },
  };
}

export class AIConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIConfigError';
  }
}
