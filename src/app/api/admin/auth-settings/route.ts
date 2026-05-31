import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { getGlobalAuthSettings, OAUTH_PROVIDER_REGISTRY, type OAuthProviderConfig } from '@/lib/auth/runtime-config';
import { userRepository } from '@/lib/db/repositories/user.repository';

async function requireAdmin(request: NextRequest) {
  const user = await resolveUser(getUserIdFromRequest(request));
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (user.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { user };
}

type SanitizedProvider = {
  enabled: boolean;
  clientId: string;
  clientSecretSet: boolean;
};

type SanitizedSettings = {
  passwordLoginEnabled: boolean;
  passwordRegisterEnabled: boolean;
  providers: Record<string, SanitizedProvider>;
};

function sanitize(settings: Awaited<ReturnType<typeof getGlobalAuthSettings>>): SanitizedSettings {
  const providers: Record<string, SanitizedProvider> = {};
  for (const [providerId, config] of Object.entries(settings.providers)) {
    providers[providerId] = {
      enabled: config.enabled,
      clientId: config.clientId,
      clientSecretSet: !!config.clientSecret,
    };
  }
  return {
    passwordLoginEnabled: settings.passwordLoginEnabled,
    passwordRegisterEnabled: settings.passwordRegisterEnabled,
    providers,
  };
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    const settings = await getGlobalAuthSettings();
    return NextResponse.json(sanitize(settings));
  } catch (error) {
    console.error('GET /api/admin/auth-settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    const current = await getGlobalAuthSettings();
    const body = await request.json().catch(() => ({}));
    const next: Record<string, unknown> = {};

    // Password settings
    if (body.passwordLoginEnabled !== undefined) {
      next.passwordLoginEnabled = Boolean(body.passwordLoginEnabled);
    }
    if (body.passwordRegisterEnabled !== undefined) {
      next.passwordRegisterEnabled = Boolean(body.passwordRegisterEnabled);
    }

    // Provider settings — accept { providers: { google: { enabled, clientId, clientSecret }, ... } }
    if (body.providers && typeof body.providers === 'object') {
      const updatedProviders: Record<string, OAuthProviderConfig> = { ...current.providers };

      for (const [providerId, providerBody] of Object.entries(body.providers as Record<string, Record<string, unknown>>)) {
        if (!OAUTH_PROVIDER_REGISTRY[providerId]) continue; // ignore unknown providers

        const existing = updatedProviders[providerId] || { enabled: false, clientId: '', clientSecret: '' };
        updatedProviders[providerId] = {
          enabled: providerBody.enabled !== undefined ? Boolean(providerBody.enabled) : existing.enabled,
          clientId: providerBody.clientId !== undefined ? String(providerBody.clientId).trim() : existing.clientId,
          clientSecret:
            providerBody.clientSecret !== undefined && String(providerBody.clientSecret).trim()
              ? String(providerBody.clientSecret).trim()
              : existing.clientSecret,
        };
      }

      // Store providers at top-level for DB (flattened structure)
      // We store the whole providers object under 'providers' key in the JSON column
      next.providers = updatedProviders;
    }

    const updated = await userRepository.updateGlobalSettings(next);
    return NextResponse.json(sanitize({ ...current, ...updated } as Awaited<ReturnType<typeof getGlobalAuthSettings>>));
  } catch (error) {
    console.error('PUT /api/admin/auth-settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
