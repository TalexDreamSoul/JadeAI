import { NextRequest } from 'next/server';
import { getServerAIConfig, hasServerAIConfig } from '@/lib/ai/server-config';

async function fetchModels(provider: string, apiKey: string, baseURL: string) {
  let models: { id: string }[] = [];

  switch (provider) {
    case 'anthropic': {
      const url = baseURL
        ? `${baseURL.replace(/\/$/, '')}/v1/models`
        : 'https://api.anthropic.com/v1/models';
      const res = await fetch(url, {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
      });
      if (!res.ok) return [];
      const data = await res.json();
      models = (data.data ?? []).map((m: { id: string }) => ({ id: m.id }));
      break;
    }

    case 'gemini': {
      const url = baseURL
        ? `${baseURL.replace(/\/$/, '')}/models?key=${apiKey}`
        : `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      models = (data.models ?? []).map((m: { name: string }) => ({
        id: m.name.replace(/^models\//, ''),
      }));
      break;
    }

    default: {
      // openai-compatible
      const effectiveBaseURL = baseURL || 'https://api.openai.com/v1';
      const res = await fetch(`${effectiveBaseURL.replace(/\/$/, '')}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) return [];
      const data = await res.json();
      models = (data.data ?? data).map((m: { id: string }) => ({ id: m.id }));
      break;
    }
  }

  return models;
}

export async function GET(request: NextRequest) {
  const requestedMode = request.headers.get('x-ai-mode');

  if (requestedMode !== 'custom' && hasServerAIConfig()) {
    const serverConfig = getServerAIConfig();
    try {
      const models = await fetchModels(serverConfig.provider, serverConfig.apiKey, serverConfig.baseURL);
      if (!models.some((m) => m.id === serverConfig.model)) {
        models.unshift({ id: serverConfig.model });
      }
      return Response.json({ models, mode: 'server', openAIEndpoint: serverConfig.openAIEndpoint });
    } catch {
      return Response.json({ models: [{ id: serverConfig.model }], mode: 'server', openAIEndpoint: serverConfig.openAIEndpoint });
    }
  }

  const provider = request.headers.get('x-provider') || 'openai';
  const apiKey = request.headers.get('x-api-key') || '';
  const baseURL = request.headers.get('x-base-url') || '';
  const model = request.headers.get('x-model') || '';

  if (!apiKey) {
    return Response.json({ models: model ? [{ id: model }] : [], mode: 'custom' });
  }

  try {
    const models = await fetchModels(provider, apiKey, baseURL);
    if (model && !models.some((m) => m.id === model)) {
      models.unshift({ id: model });
    }
    return Response.json({ models, mode: 'custom' });
  } catch {
    return Response.json({ models: model ? [{ id: model }] : [], mode: 'custom' });
  }
}
