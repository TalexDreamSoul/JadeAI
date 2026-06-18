import type { AIProvider, OpenAIEndpoint } from '@/stores/settings-store';

export type AIChannelTestInput = {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  openAIEndpoint?: string;
};

export type AIChannelHTTPRequestReport = {
  method: 'POST';
  url: string;
  headers: Record<string, string>;
  bodyJson: Record<string, unknown>;
  timeoutMs: number;
};

export type AIChannelHTTPResponseReport = {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  bodyText: string;
  bodyJson?: unknown;
  bodyJsonParseError?: string;
  bodyLength: number;
  bodyTruncated: boolean;
};

export type AIChannelHTTPErrorReport = {
  name: string;
  message: string;
  cause?: string;
};

export type AIChannelTestDiagnostics = {
  provider: AIProvider;
  inputBaseUrl: string;
  normalizedBaseUrl: string;
  preferredEndpoint: OpenAIEndpoint;
  endpointOrder: OpenAIEndpoint[];
  timeoutMs: number;
  bodyLimitChars: number;
  redaction: string;
};

export type AIChannelTestAttempt = {
  endpoint: OpenAIEndpoint;
  baseUrl: string;
  ok: boolean;
  message: string;
  elapsedMs: number;
  startedAt: string;
  completedAt: string;
  request?: AIChannelHTTPRequestReport;
  response?: AIChannelHTTPResponseReport;
  error?: AIChannelHTTPErrorReport;
  rawError?: string;
};

export type AIChannelTestResult = {
  ok: boolean;
  provider: AIProvider;
  recommendedBaseUrl: string;
  recommendedEndpoint: OpenAIEndpoint;
  model: string;
  message: string;
  diagnostics?: AIChannelTestDiagnostics;
  attempts: AIChannelTestAttempt[];
};

const DEFAULT_BASE_URLS: Record<AIProvider, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
};

const TEST_TIMEOUT_MS = 15000;
const BODY_LIMIT_CHARS = 8000;
const REDACTION_NOTE = 'Only Authorization/API Key values are redacted; upstream status, headers, body text, and parsed JSON are preserved up to bodyLimitChars.';

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

function headersToRecord(headers: Headers) {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key] = value;
  });
  return record;
}

function redactSensitiveText(value: string, apiKey: string) {
  return apiKey ? value.split(apiKey).join(`<redacted:${apiKey.length} chars>`) : value;
}

function redactRecordValues(record: Record<string, string>, apiKey: string) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, redactSensitiveText(value, apiKey)]),
  );
}

function truncateBodyText(text: string) {
  return {
    bodyText: text.length > BODY_LIMIT_CHARS ? `${text.slice(0, BODY_LIMIT_CHARS)}…[truncated]` : text,
    bodyLength: text.length,
    bodyTruncated: text.length > BODY_LIMIT_CHARS,
  };
}

function parseBodyJson(text: string): { bodyJson?: unknown; bodyJsonParseError?: string } {
  if (!text.trim()) return {};
  try {
    return { bodyJson: JSON.parse(text) };
  } catch (error) {
    return { bodyJsonParseError: error instanceof Error ? error.message : String(error || 'Unknown JSON parse error') };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function extractUpstreamMessage(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;

  const error = value.error;
  if (isRecord(error)) {
    const message = stringValue(error.message);
    const type = stringValue(error.type);
    const code = stringValue(error.code);
    const requestId = stringValue(error.request_id) || stringValue(error.requestId);
    return [message, type ? `type=${type}` : undefined, code ? `code=${code}` : undefined, requestId ? `request_id=${requestId}` : undefined]
      .filter(Boolean)
      .join(' · ');
  }

  const directMessage = stringValue(value.message) || stringValue(value.error) || stringValue(value.detail);
  if (directMessage) return directMessage;

  return undefined;
}

function extractOutputSnippet(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;

  const outputText = stringValue(value.output_text);
  if (outputText) return outputText;

  const choices = value.choices;
  if (Array.isArray(choices)) {
    for (const choice of choices) {
      if (!isRecord(choice)) continue;
      const message = choice.message;
      if (isRecord(message)) {
        const content = stringValue(message.content);
        if (content) return content;
      }
      const text = stringValue(choice.text);
      if (text) return text;
    }
  }

  return undefined;
}

function responseMessage(endpoint: OpenAIEndpoint, response: AIChannelHTTPResponseReport) {
  const status = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
  const upstreamMessage = extractUpstreamMessage(response.bodyJson);
  if (!response.ok) {
    const bodySummary = upstreamMessage || response.bodyText.slice(0, 500) || 'empty response body';
    return `${endpoint} ${status}: ${bodySummary}`;
  }

  const output = extractOutputSnippet(response.bodyJson) || response.bodyText.slice(0, 200) || 'empty response body';
  return `${endpoint} ${status}: ${output}`;
}

function errorReport(error: unknown, apiKey: string): AIChannelHTTPErrorReport {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: redactSensitiveText(error.message, apiKey),
      cause: error.cause ? redactSensitiveText(String(error.cause).slice(0, 1000), apiKey) : undefined,
    };
  }
  return { name: 'UnknownError', message: redactSensitiveText(String(error || 'Unknown error'), apiKey) };
}

function errorMessage(endpoint: OpenAIEndpoint, error: AIChannelHTTPErrorReport) {
  return `${endpoint} transport error: ${error.name}: ${error.message}`;
}

function buildEndpointRequest(endpoint: OpenAIEndpoint, input: { apiKey: string; baseUrl: string; model: string }): { actualHeaders: Record<string, string>; report: AIChannelHTTPRequestReport } {
  const url = endpoint === 'chat'
    ? `${input.baseUrl}/chat/completions`
    : `${input.baseUrl}/responses`;
  const bodyJson = endpoint === 'chat'
    ? {
      model: input.model,
      messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
      temperature: 0,
      max_tokens: 8,
    }
    : {
      model: input.model,
      input: 'Reply with exactly: ok',
      max_output_tokens: 8,
      store: false,
    };
  const actualHeaders = {
    authorization: `Bearer ${input.apiKey}`,
    'content-type': 'application/json',
  };

  return {
    actualHeaders,
    report: {
      method: 'POST',
      url,
      headers: {
        authorization: `Bearer <redacted:${input.apiKey.length} chars>`,
        'content-type': 'application/json',
      },
      bodyJson,
      timeoutMs: TEST_TIMEOUT_MS,
    },
  };
}

async function readResponseReport(response: Response, apiKey: string): Promise<AIChannelHTTPResponseReport> {
  const text = redactSensitiveText(await response.text(), apiKey);
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    headers: redactRecordValues(headersToRecord(response.headers), apiKey),
    ...truncateBodyText(text),
    ...parseBodyJson(text),
  };
}

async function testOpenAIEndpoint(endpoint: OpenAIEndpoint, input: { apiKey: string; baseUrl: string; model: string }): Promise<AIChannelTestAttempt> {
  const startedAt = new Date();
  const { actualHeaders, report: request } = buildEndpointRequest(endpoint, input);

  try {
    const response = await fetch(request.url, {
      method: request.method,
      headers: actualHeaders,
      body: JSON.stringify(request.bodyJson),
      signal: AbortSignal.timeout(TEST_TIMEOUT_MS),
    });
    const responseReport = await readResponseReport(response, input.apiKey);
    const completedAt = new Date();
    const message = responseMessage(endpoint, responseReport);
    return {
      endpoint,
      baseUrl: input.baseUrl,
      ok: responseReport.ok,
      message,
      elapsedMs: completedAt.getTime() - startedAt.getTime(),
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      request,
      response: responseReport,
      rawError: responseReport.ok ? undefined : message,
    };
  } catch (error) {
    const completedAt = new Date();
    const report = errorReport(error, input.apiKey);
    const message = errorMessage(endpoint, report);
    return {
      endpoint,
      baseUrl: input.baseUrl,
      ok: false,
      message,
      elapsedMs: completedAt.getTime() - startedAt.getTime(),
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      request,
      error: report,
      rawError: message,
    };
  }
}

function buildDiagnostics(input: { provider: AIProvider; inputBaseUrl: string; normalizedBaseUrl: string; openAIEndpoint?: string }): AIChannelTestDiagnostics {
  const preferredEndpoint = normalizeEndpoint(input.openAIEndpoint);
  return {
    provider: input.provider,
    inputBaseUrl: input.inputBaseUrl,
    normalizedBaseUrl: input.normalizedBaseUrl,
    preferredEndpoint,
    endpointOrder: endpointPriority(input.openAIEndpoint),
    timeoutMs: TEST_TIMEOUT_MS,
    bodyLimitChars: BODY_LIMIT_CHARS,
    redaction: REDACTION_NOTE,
  };
}

async function testOpenAICompatible(input: Required<Pick<AIChannelTestInput, 'apiKey' | 'baseUrl' | 'model'>> & { openAIEndpoint?: string }): Promise<AIChannelTestResult> {
  const recommendedBaseUrl = normalizeOpenAICompatibleBaseUrl(input.baseUrl);
  const diagnostics = buildDiagnostics({ provider: 'openai', inputBaseUrl: input.baseUrl, normalizedBaseUrl: recommendedBaseUrl, openAIEndpoint: input.openAIEndpoint });
  const attempts: AIChannelTestAttempt[] = [];

  for (const endpoint of diagnostics.endpointOrder) {
    const attempt = await testOpenAIEndpoint(endpoint, { apiKey: input.apiKey, baseUrl: recommendedBaseUrl, model: input.model });
    attempts.push(attempt);
    if (attempt.ok) {
      return {
        ok: true,
        provider: 'openai',
        recommendedBaseUrl,
        recommendedEndpoint: endpoint,
        model: input.model,
        message: endpoint === normalizeEndpoint(input.openAIEndpoint)
          ? attempt.message
          : `${attempt.message}；建议端点切换为 ${endpoint}。`,
        diagnostics,
        attempts,
      };
    }
  }

  return {
    ok: false,
    provider: 'openai',
    recommendedBaseUrl,
    recommendedEndpoint: normalizeEndpoint(input.openAIEndpoint),
    model: input.model,
    message: attempts.map((attempt) => attempt.message).join(' | ') || 'AI channel test failed with no attempt report.',
    diagnostics,
    attempts,
  };
}

export async function testAIChannelConfig(input: AIChannelTestInput): Promise<AIChannelTestResult> {
  const provider = normalizeProvider(input.provider);
  const apiKey = input.apiKey.trim();
  const model = input.model.trim();
  const defaultBaseUrl = DEFAULT_BASE_URLS[provider];
  const inputBaseUrl = input.baseUrl.trim() || defaultBaseUrl;
  const recommendedBaseUrl = provider === 'openai'
    ? normalizeOpenAICompatibleBaseUrl(inputBaseUrl)
    : inputBaseUrl;
  const diagnostics = buildDiagnostics({ provider, inputBaseUrl, normalizedBaseUrl: recommendedBaseUrl, openAIEndpoint: input.openAIEndpoint });

  if (!apiKey || !model) {
    return {
      ok: false,
      provider,
      recommendedBaseUrl,
      recommendedEndpoint: normalizeEndpoint(input.openAIEndpoint),
      model,
      message: `Validation failed before HTTP request: ${!apiKey ? 'apiKey is empty' : 'model is empty'}.`,
      diagnostics,
      attempts: [],
    };
  }

  if (provider === 'openai') {
    return testOpenAICompatible({ apiKey, baseUrl: inputBaseUrl, model, openAIEndpoint: input.openAIEndpoint });
  }

  return {
    ok: false,
    provider,
    recommendedBaseUrl,
    recommendedEndpoint: normalizeEndpoint(input.openAIEndpoint),
    model,
    message: `Unsupported provider for live HTTP test: ${provider}. Current detailed test runner only sends OpenAI-compatible requests.`,
    diagnostics,
    attempts: [],
  };
}
