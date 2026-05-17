import { NextRequest } from 'next/server';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';
import { getServerAIConfig, hasServerAIConfig, type OpenAIEndpoint } from './server-config';

export interface AIConfig {
  provider: string;
  apiKey: string;
  baseURL: string;
  model: string;
  mode: 'server' | 'custom';
  openAIEndpoint: OpenAIEndpoint;
}

function normalizeOpenAIEndpoint(value: string | null): OpenAIEndpoint {
  return value === 'responses' ? 'responses' : 'chat';
}

export function extractAIConfig(request: NextRequest): AIConfig {
  const requestedMode = request.headers.get('x-ai-mode');
  const wantsServerAI = requestedMode !== 'custom';

  if (wantsServerAI && hasServerAIConfig()) {
    return { ...getServerAIConfig(), mode: 'server' };
  }

  const provider = request.headers.get('x-provider') || 'openai';
  const apiKey = request.headers.get('x-api-key') || '';
  const baseURL = request.headers.get('x-base-url') || 'https://api.openai.com/v1';
  const model = request.headers.get('x-model') || 'gpt-4o';
  return {
    provider,
    apiKey,
    baseURL,
    model,
    mode: 'custom',
    openAIEndpoint: normalizeOpenAIEndpoint(request.headers.get('x-openai-endpoint')),
  };
}

export function getModel(config: AIConfig, modelOverride?: string): LanguageModel {
  if (!config.apiKey) {
    throw new AIConfigError(
      config.mode === 'server'
        ? 'Unified AI is not configured. Please set AI_API_KEY on the server or switch to custom AI in Settings.'
        : 'API key is required. Please configure it in Settings.'
    );
  }
  const modelId = modelOverride || config.model;

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

  return {
    openai: config.openAIEndpoint === 'responses'
      ? {
          // Responses API stores generations by default; keep TouchResume calls stateless.
          store: false,
        }
      : {},
  };
}

export class AIConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIConfigError';
  }
}
