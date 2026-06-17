import { ChatOpenAI } from '@langchain/openai';
import type { AIProvider, OpenAIEndpoint } from '@/stores/settings-store';

export type AIChannelTestInput = {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  openAIEndpoint?: string;
};

export type AIChannelTestAttempt = {
  endpoint: OpenAIEndpoint;
  baseUrl: string;
  ok: boolean;
  message: string;
  elapsedMs: number;
  rawError?: string;
};

export type AIChannelTestResult = {
  ok: boolean;
  provider: AIProvider;
  recommendedBaseUrl: string;
  recommendedEndpoint: OpenAIEndpoint;
  model: string;
  message: string;
  attempts: AIChannelTestAttempt[];
};

const DEFAULT_BASE_URLS: Record<AIProvider, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
};

function normalizeProvider(value: string | undefined): AIProvider {
  if (value === 'anthropic' || value === 'gemini' || value === 'openai') return value;
  return 'openai';
}

function normalizeEndpoint(value: string | undefined): OpenAIEndpoint {
  return value === 'responses' ? 'responses' : 'chat';
}

function withoutTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

export function normalizeOpenAICompatibleBaseUrl(rawBaseUrl: string) {
  const trimmed = rawBaseUrl.trim();
  if (!trimmed) return DEFAULT_BASE_URLS.openai;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    url = new URL(`https://${trimmed}`);
  }

  const path = withoutTrailingSlash(url.pathname || '');
  const cleanedPath = path
    .replace(/\/chat\/completions$/i, '')
    .replace(/\/responses$/i, '')
    .replace(/\/completions$/i, '');
  url.pathname = cleanedPath || '/';
  url.search = '';
  url.hash = '';

  const normalized = withoutTrailingSlash(url.toString());
  return /\/v\d+(?:\/.*)?$/i.test(url.pathname)
    ? normalized
    : `${normalized}/v1`;
}

function endpointPriority(endpoint?: string): OpenAIEndpoint[] {
  const first = normalizeEndpoint(endpoint);
  return first === 'responses' ? ['responses', 'chat'] : ['chat', 'responses'];
}

function classifyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || 'Unknown error');
  const lower = message.toLowerCase();
  if (lower.includes('401') || lower.includes('403') || lower.includes('unauthorized') || lower.includes('invalid api key')) {
    return '认证失败：请检查 API Key、Base URL 和供应商账户状态。';
  }
  if (lower.includes('404') || lower.includes('not found')) {
    return '接口不存在：请检查 Base URL 是否需要 /v1，或端点类型是否选错。';
  }
  if (lower.includes('model') && (lower.includes('not found') || lower.includes('does not exist') || lower.includes('unsupported'))) {
    return '模型不可用：请检查模型名是否正确，或该渠道是否支持该模型。';
  }
  if (lower.includes('response') && lower.includes('not supported')) {
    return 'Responses 端点不兼容：建议切换到 Chat Completions。';
  }
  if (lower.includes('rate limit') || lower.includes('quota') || lower.includes('insufficient')) {
    return '额度或限流异常：请检查供应商额度、账单和限流策略。';
  }
  return message.slice(0, 500);
}

async function testOpenAIChat(input: { apiKey: string; baseUrl: string; model: string }) {
  const model = new ChatOpenAI({
    apiKey: input.apiKey,
    configuration: { baseURL: input.baseUrl },
    model: input.model,
    temperature: 0,
    maxTokens: 8,
    timeout: 15000,
  });
  const result = await model.invoke('Reply with exactly: ok');
  return typeof result.content === 'string'
    ? result.content
    : JSON.stringify(result.content).slice(0, 200);
}

async function testOpenAIResponses(input: { apiKey: string; baseUrl: string; model: string }) {
  const response = await fetch(`${input.baseUrl}/responses`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: input.model,
      input: 'Reply with exactly: ok',
      max_output_tokens: 8,
      store: false,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 500)}`);
  return text.slice(0, 200);
}

async function testOpenAICompatible(input: Required<Pick<AIChannelTestInput, 'apiKey' | 'baseUrl' | 'model'>> & { openAIEndpoint?: string }): Promise<AIChannelTestResult> {
  const recommendedBaseUrl = normalizeOpenAICompatibleBaseUrl(input.baseUrl);
  const attempts: AIChannelTestAttempt[] = [];

  for (const endpoint of endpointPriority(input.openAIEndpoint)) {
    const startedAt = Date.now();
    try {
      const content = endpoint === 'chat'
        ? await testOpenAIChat({ apiKey: input.apiKey, baseUrl: recommendedBaseUrl, model: input.model })
        : await testOpenAIResponses({ apiKey: input.apiKey, baseUrl: recommendedBaseUrl, model: input.model });
      attempts.push({ endpoint, baseUrl: recommendedBaseUrl, ok: true, message: `测试成功：${content || 'ok'}`.slice(0, 200), elapsedMs: Date.now() - startedAt });
      return {
        ok: true,
        provider: 'openai',
        recommendedBaseUrl,
        recommendedEndpoint: endpoint,
        model: input.model,
        message: endpoint === normalizeEndpoint(input.openAIEndpoint)
          ? 'AI 渠道测试成功。'
          : `AI 渠道测试成功，建议端点切换为 ${endpoint}。`,
        attempts,
      };
    } catch (error) {
      attempts.push({
        endpoint,
        baseUrl: recommendedBaseUrl,
        ok: false,
        message: classifyError(error),
        elapsedMs: Date.now() - startedAt,
        rawError: error instanceof Error ? error.message.slice(0, 1000) : String(error || '').slice(0, 1000),
      });
    }
  }

  return {
    ok: false,
    provider: 'openai',
    recommendedBaseUrl,
    recommendedEndpoint: normalizeEndpoint(input.openAIEndpoint),
    model: input.model,
    message: attempts[0]?.message || 'AI 渠道测试失败，请检查配置。',
    attempts,
  };
}

export async function testAIChannelConfig(input: AIChannelTestInput): Promise<AIChannelTestResult> {
  const provider = normalizeProvider(input.provider);
  const apiKey = input.apiKey.trim();
  const model = input.model.trim();
  if (!apiKey || !model) {
    return {
      ok: false,
      provider,
      recommendedBaseUrl: input.baseUrl.trim() || DEFAULT_BASE_URLS[provider],
      recommendedEndpoint: normalizeEndpoint(input.openAIEndpoint),
      model,
      message: 'API Key 和模型不能为空。',
      attempts: [],
    };
  }

  if (provider === 'openai') {
    return testOpenAICompatible({ apiKey, baseUrl: input.baseUrl || DEFAULT_BASE_URLS.openai, model, openAIEndpoint: input.openAIEndpoint });
  }

  return {
    ok: false,
    provider,
    recommendedBaseUrl: input.baseUrl.trim() || DEFAULT_BASE_URLS[provider],
    recommendedEndpoint: normalizeEndpoint(input.openAIEndpoint),
    model,
    message: '当前测试调用优先支持 OpenAI-compatible 渠道；Anthropic/Gemini 可保存后通过用量日志观察。',
    attempts: [],
  };
}
