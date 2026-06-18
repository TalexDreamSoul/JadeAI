import { afterEach, describe, expect, it, vi } from 'vitest';
import { testAIChannelConfig } from './compatibility';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('testAIChannelConfig HTTP reporting', () => {
  it('keeps upstream HTTP details and redacts API keys', async () => {
    const apiKey = 'sk-secret-test-key';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      error: {
        message: `Invalid token ${apiKey}`,
        type: 'new_api_error',
        code: 'invalid_token',
      },
    }), {
      status: 401,
      statusText: 'Unauthorized',
      headers: {
        'content-type': 'application/json',
        'x-oneapi-request-id': 'req-123',
        'x-debug-key': apiKey,
      },
    }));

    const result = await testAIChannelConfig({
      provider: 'openai',
      apiKey,
      baseUrl: 'https://newapi.example.com/v1',
      model: 'gpt-test',
      openAIEndpoint: 'responses',
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('HTTP 401 Unauthorized');
    expect(result.message).toContain('Invalid token <redacted:18 chars>');
    expect(result.diagnostics).toMatchObject({
      inputBaseUrl: 'https://newapi.example.com/v1',
      normalizedBaseUrl: 'https://newapi.example.com/v1',
      endpointOrder: ['responses', 'chat'],
    });
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[0].request).toMatchObject({
      method: 'POST',
      url: 'https://newapi.example.com/v1/responses',
      headers: { authorization: 'Bearer <redacted:18 chars>' },
      bodyJson: { model: 'gpt-test', input: 'Reply with exactly: ok' },
    });
    expect(result.attempts[0].response).toMatchObject({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      headers: {
        'content-type': 'application/json',
        'x-oneapi-request-id': 'req-123',
        'x-debug-key': '<redacted:18 chars>',
      },
      bodyJson: {
        error: {
          message: 'Invalid token <redacted:18 chars>',
          type: 'new_api_error',
          code: 'invalid_token',
        },
      },
      bodyTruncated: false,
    });
    expect(JSON.stringify(result)).not.toContain(apiKey);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reports transport errors with request metadata', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('connect ETIMEDOUT'));

    const result = await testAIChannelConfig({
      provider: 'openai',
      apiKey: 'sk-timeout',
      baseUrl: 'newapi.example.com',
      model: 'gpt-test',
      openAIEndpoint: 'chat',
    });

    expect(result.ok).toBe(false);
    expect(result.recommendedBaseUrl).toBe('https://newapi.example.com/v1');
    expect(result.message).toContain('chat transport error: Error: connect ETIMEDOUT');
    expect(result.attempts[0]).toMatchObject({
      endpoint: 'chat',
      baseUrl: 'https://newapi.example.com/v1',
      ok: false,
      error: { name: 'Error', message: 'connect ETIMEDOUT' },
    });
    expect(result.attempts[0].request?.url).toBe('https://newapi.example.com/v1/chat/completions');
  });
});
