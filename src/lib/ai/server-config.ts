import type { AIProvider } from '@/stores/settings-store';

export type OpenAIEndpoint = 'chat' | 'responses';

export interface ServerAIConfig {
  provider: AIProvider;
  apiKey: string;
  baseURL: string;
  model: string;
  openAIEndpoint: OpenAIEndpoint;
}

const DEFAULT_BASE_URLS: Record<AIProvider, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
};

const DEFAULT_MODELS: Record<AIProvider, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-20250514',
  gemini: 'gemini-2.0-flash',
};

function normalizeProvider(value: string | undefined): AIProvider {
  if (value === 'anthropic' || value === 'gemini' || value === 'openai') return value;
  return 'openai';
}

function normalizeOpenAIEndpoint(value: string | undefined): OpenAIEndpoint {
  return value === 'responses' ? 'responses' : 'chat';
}

export function getServerAIConfig(): ServerAIConfig {
  const provider = normalizeProvider(process.env.AI_PROVIDER);
  return {
    provider,
    apiKey: process.env.AI_API_KEY || '',
    baseURL: process.env.AI_BASE_URL || DEFAULT_BASE_URLS[provider],
    model: process.env.AI_MODEL || DEFAULT_MODELS[provider],
    openAIEndpoint: normalizeOpenAIEndpoint(process.env.AI_OPENAI_ENDPOINT),
  };
}

export function hasServerAIConfig(): boolean {
  return !!getServerAIConfig().apiKey;
}

export function getServerImageAIConfig() {
  return {
    apiKey: process.env.IMAGE_AI_API_KEY || process.env.GEMINI_API_KEY || '',
    model: process.env.IMAGE_AI_MODEL || 'gemini-3.1-flash-image-preview',
    baseURL: process.env.IMAGE_AI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
  };
}

export function hasServerImageAIConfig(): boolean {
  return !!getServerImageAIConfig().apiKey;
}
