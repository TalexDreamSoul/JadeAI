import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { getGlobalAuthSettings, getOidcCallbackUrl } from '@/lib/auth/runtime-config';
import { userRepository } from '@/lib/db/repositories/user.repository';

async function requireAdmin(request: NextRequest) {
  const user = await resolveUser(getUserIdFromRequest(request));
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (user.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { user };
}

type SanitizedProvider = {
  enabled: boolean;
  configured: boolean;
  clientId: string;
  issuer: string;
  name: string;
  source: string;
  callbackUrl: string;
  clientSecretSet: boolean;
};

type SanitizedSettings = {
  authMode: string;
  passwordLoginEnabled: boolean;
  passwordRegisterEnabled: boolean;
  publicPasswordEnabled: boolean;
  adminPasswordEnabled: boolean;
  loginFooterText: string;
  loginFooterLinkText: string;
  loginFooterLinkUrl: string;
  providers: Record<string, SanitizedProvider>;
};

function sanitize(settings: Awaited<ReturnType<typeof getGlobalAuthSettings>>, request?: NextRequest): SanitizedSettings {
  const providers: Record<string, SanitizedProvider> = {};
  for (const [providerId, config] of Object.entries(settings.providers)) {
    providers[providerId] = {
      enabled: config.enabled,
      configured: !!(config.enabled && config.clientId && config.clientSecret && config.issuer),
      clientId: config.clientId,
      issuer: config.issuer,
      name: config.name || providerId,
      source: config.source || 'env',
      callbackUrl: providerId === 'oidc' ? getOidcCallbackUrl(request) : '',
      clientSecretSet: !!config.clientSecret,
    };
  }
  return {
    authMode: settings.authMode,
    passwordLoginEnabled: settings.passwordLoginEnabled,
    passwordRegisterEnabled: settings.passwordRegisterEnabled,
    publicPasswordEnabled: settings.publicPasswordEnabled,
    adminPasswordEnabled: settings.adminPasswordEnabled,
    loginFooterText: settings.loginFooterText,
    loginFooterLinkText: settings.loginFooterLinkText,
    loginFooterLinkUrl: settings.loginFooterLinkUrl,
    providers,
  };
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    const settings = await getGlobalAuthSettings();
    return NextResponse.json(sanitize(settings, request));
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

    // Local-mode password settings. In OIDC production modes, env auth mode controls visibility.
    if (body.passwordLoginEnabled !== undefined) {
      next.passwordLoginEnabled = Boolean(body.passwordLoginEnabled);
    }
    if (body.passwordRegisterEnabled !== undefined) {
      next.passwordRegisterEnabled = Boolean(body.passwordRegisterEnabled);
    }

    if (body.loginFooterText !== undefined) {
      next.loginFooterText = String(body.loginFooterText || '').trim();
    }
    if (body.loginFooterLinkText !== undefined) {
      next.loginFooterLinkText = String(body.loginFooterLinkText || '').trim();
    }
    if (body.loginFooterLinkUrl !== undefined) {
      next.loginFooterLinkUrl = String(body.loginFooterLinkUrl || '').trim();
    }

    const updated = await userRepository.updateGlobalSettings(next);
    return NextResponse.json(sanitize({ ...current, ...updated } as Awaited<ReturnType<typeof getGlobalAuthSettings>>, request));
  } catch (error) {
    console.error('PUT /api/admin/auth-settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
