import { NextRequest } from 'next/server';
import { resolveAIRequestUser } from '@/lib/ai/provider';
import { selectServerAIConfig } from '@/lib/ai/server-config';
import { getUserEntitlementProfile } from '@/lib/commercial/entitlement-service';
import { inferAIModelTier } from '@/lib/commercial/ai-model-tier-service';

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
  const user = await resolveAIRequestUser(request);
  if (!user) {
    return Response.json({ models: [], mode: 'server', loginRequired: true });
  }
  const profile = await getUserEntitlementProfile(user.id, Number(user.aiCredits || 0)).catch(() => null);

  const serverConfig = await selectServerAIConfig();
  if (!serverConfig.apiKey) {
    return Response.json({ models: [], mode: 'server', configured: false });
  }

  const allowedModelTier = String(profile?.entitlements['ai.model_tier'] || 'basic');
  const requiredModelTier = inferAIModelTier(serverConfig.model);
  const tierPayload = { allowedModelTier, requiredModelTier };

  try {
    const models = await fetchModels(serverConfig.provider, serverConfig.apiKey, serverConfig.baseURL);
    if (!models.some((m) => m.id === serverConfig.model)) {
      models.unshift({ id: serverConfig.model });
    }
    return Response.json({ models, mode: 'server', openAIEndpoint: serverConfig.openAIEndpoint, ...tierPayload });
  } catch {
    return Response.json({ models: [{ id: serverConfig.model }], mode: 'server', openAIEndpoint: serverConfig.openAIEndpoint, ...tierPayload });
  }
}
