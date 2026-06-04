import type { Provider } from 'next-auth/providers';
import Credentials from 'next-auth/providers/credentials';
import { config } from '@/lib/config';
import { dbReady } from '@/lib/db';
import { userRepository } from '@/lib/db/repositories/user.repository';
import { createSampleResume } from '@/lib/db/sample-resume';
import { hashPasswordForAuth, normalizeEmail, verifyPasswordForAuth } from './password';

// ── OAuth provider registry ──────────────────────────────────────────────

export interface OAuthProviderMeta {
  id: string;
  name: string; // human-readable, e.g. "OIDC"
}

/** Generic OIDC provider configured from environment variables. */
export const GENERIC_OIDC_PROVIDER_ID = 'oidc' as const;

export const OAUTH_PROVIDER_REGISTRY: Record<string, OAuthProviderMeta> = {
  [GENERIC_OIDC_PROVIDER_ID]: {
    id: GENERIC_OIDC_PROVIDER_ID,
    name: 'OIDC',
  },
} as const;

export type OAuthProviderId = keyof typeof OAUTH_PROVIDER_REGISTRY;
export type AuthMode = 'local' | 'oidc-only' | 'oidc-with-admin-password';

export function isOAuthProviderId(value: string): value is OAuthProviderId {
  return value in OAUTH_PROVIDER_REGISTRY;
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface OAuthProviderConfig {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  issuer: string;
  name?: string;
  source?: 'env' | 'none';
}

export interface GlobalAuthSettings {
  authMode: AuthMode;
  passwordLoginEnabled: boolean;
  passwordRegisterEnabled: boolean;
  publicPasswordEnabled: boolean;
  adminPasswordEnabled: boolean;
  loginFooterText: string;
  loginFooterLinkText: string;
  loginFooterLinkUrl: string;
  providers: Record<string, OAuthProviderConfig>;
}

export interface PublicAuthProviderConfig {
  id: string;
  enabled: boolean;
  loginEnabled?: boolean;
  registerEnabled?: boolean;
  name?: string; // human-readable name for UI
}

// ── Helpers ───────────────────────────────────────────────────────────────

type AuthDbUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  role?: string | null;
  passwordHash?: string | null;
};

function boolSetting(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function stringSetting(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function envString(name: string, fallback = ''): string {
  return (process.env[name] || fallback).trim();
}

function envBool(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  return !['0', 'false', 'no', 'off'].includes(value.toLowerCase());
}

function parseAuthMode(value: unknown): AuthMode | null {
  if (typeof value !== 'string') return null;
  const normalized = value.toLowerCase().trim();
  if (normalized === 'local' || normalized === 'oidc-only' || normalized === 'oidc-with-admin-password') return normalized;
  return null;
}

export function getAuthMode(): AuthMode {
  const envMode = parseAuthMode(envString('AUTH_MODE'));
  if (envMode) return envMode;
  // Backwards-compatible default: keep local auth unless OIDC is explicitly enabled by env.
  return envBool('AUTH_OIDC_ENABLED', false) ? 'oidc-with-admin-password' : 'local';
}

export function getExternalAppUrl(): string {
  return (
    envString('AUTH_URL') ||
    envString('NEXTAUTH_URL') ||
    envString('PUBLIC_APP_URL') ||
    envString('NEXT_PUBLIC_APP_URL') ||
    envString('APP_URL')
  ).replace(/\/+$/, '');
}

export function getExternalAppUrlFromRequest(request?: Request): string {
  const configured = getExternalAppUrl();
  if (configured) return configured;
  if (!request) return '';

  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  if (!forwardedHost) return '';
  const forwardedProto = request.headers.get('x-forwarded-proto') || (forwardedHost.includes('localhost') ? 'http' : 'https');
  return `${forwardedProto}://${forwardedHost}`.replace(/\/+$/, '');
}

export function getOidcCallbackUrl(request?: Request): string {
  const base = getExternalAppUrlFromRequest(request);
  return base ? `${base}/api/auth/callback/${GENERIC_OIDC_PROVIDER_ID}` : `/api/auth/callback/${GENERIC_OIDC_PROVIDER_ID}`;
}

export function getAdminEmails(): string[] {
  return envString('ADMIN_EMAILS')
    .split(/[,;\s]+/)
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
}

function getEnvOidcProvider(): OAuthProviderConfig {
  const enabled = envBool('AUTH_OIDC_ENABLED', false);
  return {
    enabled,
    clientId: envString('AUTH_OIDC_CLIENT_ID'),
    clientSecret: envString('AUTH_OIDC_CLIENT_SECRET'),
    issuer: envString('AUTH_OIDC_ISSUER').replace(/\/+$/, ''),
    name: envString('AUTH_OIDC_NAME', 'OIDC'),
    source: enabled ? 'env' : 'none',
  };
}

export function isOidcProviderConfigured(provider: OAuthProviderConfig): boolean {
  return !!(provider.enabled && provider.clientId && provider.clientSecret && provider.issuer);
}

// ── Provider factory map ──────────────────────────────────────────────────

type OIDCProfile = {
  sub?: string;
  id?: string;
  email?: string | null;
  name?: string | null;
  picture?: string | null;
  avatar_url?: string | null;
};

const oauthProviderFactories: Record<string, (config: OAuthProviderConfig) => Provider> = {
  [GENERIC_OIDC_PROVIDER_ID]: (c) => ({
    id: GENERIC_OIDC_PROVIDER_ID,
    name: c.name?.trim() || 'OIDC',
    type: 'oidc',
    issuer: c.issuer,
    clientId: c.clientId,
    clientSecret: c.clientSecret,
    checks: ['pkce', 'state'],
    profile(profile: OIDCProfile) {
      return {
        id: profile.sub || profile.id || profile.email || '',
        name: profile.name || profile.email || 'OIDC User',
        email: profile.email,
        image: profile.picture || profile.avatar_url,
      };
    },
  }),
};

// ── Settings ──────────────────────────────────────────────────────────────

/**
 * Read persisted DB settings (set via admin panel) plus env-defined auth providers.
 * OIDC secrets are intentionally env-only in production modes.
 */
export async function getGlobalAuthSettings(): Promise<GlobalAuthSettings> {
  await dbReady;
  const rawSettings = await userRepository.getGlobalSettings();
  const authMode = parseAuthMode(rawSettings.authMode) || getAuthMode();

  const localPasswordLoginEnabled = boolSetting(
    rawSettings.passwordLoginEnabled,
    process.env.AUTH_PASSWORD_ENABLED !== 'false'
  );
  const envPublicPasswordEnabled = authMode === 'local'
    ? localPasswordLoginEnabled
    : envBool('AUTH_PASSWORD_PUBLIC_ENABLED', false);
  const publicPasswordEnabled = boolSetting(rawSettings.publicPasswordEnabled, envPublicPasswordEnabled);
  const passwordRegisterEnabled = boolSetting(
    rawSettings.passwordRegisterEnabled,
    authMode === 'local'
      ? process.env.AUTH_PASSWORD_REGISTER_ENABLED !== 'false'
      : envBool('AUTH_PASSWORD_REGISTER_ENABLED', false)
  );
  const adminPasswordEnabled = boolSetting(
    rawSettings.adminPasswordEnabled,
    authMode === 'oidc-with-admin-password'
      ? envBool('AUTH_ADMIN_PASSWORD_ENABLED', true)
      : authMode === 'local' && localPasswordLoginEnabled
  );

  return {
    authMode,
    passwordLoginEnabled: localPasswordLoginEnabled,
    passwordRegisterEnabled,
    publicPasswordEnabled,
    adminPasswordEnabled,
    loginFooterText: stringSetting(rawSettings.loginFooterText, ''),
    loginFooterLinkText: stringSetting(rawSettings.loginFooterLinkText, ''),
    loginFooterLinkUrl: stringSetting(rawSettings.loginFooterLinkUrl, ''),
    providers: {
      [GENERIC_OIDC_PROVIDER_ID]: getEnvOidcProvider(),
    },
  };
}

/** Returns only the public-safe subset for the normal login dialog. */
export async function getPublicAuthProviders(): Promise<PublicAuthProviderConfig[]> {
  const settings = await getGlobalAuthSettings();
  const result: PublicAuthProviderConfig[] = [];

  if (settings.publicPasswordEnabled || settings.passwordRegisterEnabled) {
    result.push({
      id: 'password',
      enabled: true,
      loginEnabled: settings.publicPasswordEnabled,
      registerEnabled: settings.passwordRegisterEnabled,
    });
  }

  for (const [providerId, providerConfig] of Object.entries(settings.providers)) {
    if (isOidcProviderConfigured(providerConfig)) {
      const meta = OAUTH_PROVIDER_REGISTRY[providerId];
      result.push({
        id: providerId,
        enabled: true,
        name: providerConfig.name || meta?.name || providerId,
      });
    }
  }

  return result;
}

// ── Providers ─────────────────────────────────────────────────────────────

export async function createPasswordProvider(): Promise<Provider> {
  return Credentials({
    id: 'password',
    name: 'Email',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      const settings = await getGlobalAuthSettings();
      if (!settings.publicPasswordEnabled && !settings.adminPasswordEnabled) {
        return null;
      }

      const email = normalizeEmail(String(credentials?.email || ''));
      const password = String(credentials?.password || '');
      if (!email || !password) return null;

      const dbUser = await userRepository.findByEmail(email);
      if (!dbUser || !(await verifyPasswordForAuth(password, (dbUser as AuthDbUser).passwordHash))) {
        return null;
      }

      // In OIDC + admin password mode, password login is an emergency/admin entry only.
      if (settings.authMode === 'oidc-with-admin-password' && dbUser.role !== 'admin') {
        return null;
      }

      return {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
      };
    },
  });
}

export function createFingerprintProvider(): Provider {
  return Credentials({
    name: 'Fingerprint',
    credentials: {
      fingerprint: { label: 'Fingerprint', type: 'text' },
    },
    async authorize(credentials) {
      const fingerprint = credentials?.fingerprint as string;
      if (!fingerprint) return null;
      return {
        id: `fp_${fingerprint}`,
        name: 'Anonymous User',
      };
    },
  });
}

export async function createRuntimeProviders(): Promise<Provider[]> {
  const settings = await getGlobalAuthSettings();
  const providers: Provider[] = [];

  if (settings.publicPasswordEnabled || settings.adminPasswordEnabled) {
    providers.push(await createPasswordProvider());
  }

  for (const [providerId, providerConfig] of Object.entries(settings.providers)) {
    if (!isOidcProviderConfigured(providerConfig)) continue;

    const factory = oauthProviderFactories[providerId];
    if (factory) {
      providers.push(factory(providerConfig));
    }
  }

  // Keep fingerprint sign-in available only as a compatibility fallback for old no-auth deployments.
  if (!config.auth.enabled) {
    providers.push(createFingerprintProvider());
  }

  return providers;
}

// ── Registration ──────────────────────────────────────────────────────────

export async function registerPasswordUser(input: {
  email: string;
  password: string;
  name?: string;
}) {
  const settings = await getGlobalAuthSettings();
  if (!settings.passwordRegisterEnabled) {
    return { error: 'Registration is disabled', status: 403 } as const;
  }

  const email = normalizeEmail(input.email);
  const password = input.password;
  const name = (input.name || '').trim() || email.split('@')[0];

  if (!email || !email.includes('@')) {
    return { error: 'Invalid email', status: 400 } as const;
  }
  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters', status: 400 } as const;
  }

  const existing = await userRepository.findByEmail(email);
  if (existing) {
    return { error: 'Email already registered', status: 409 } as const;
  }

  const hasAdmin = await userRepository.findFirstAdmin();
  const user = await userRepository.create({
    email,
    name,
    passwordHash: await hashPasswordForAuth(password),
    authType: 'password',
    role: settings.authMode === 'local' && !hasAdmin ? 'admin' : 'user',
  });

  if (user) {
    await createSampleResume(user.id);
  }

  return {
    loginEnabled: settings.publicPasswordEnabled,
    user: user
      ? {
          id: user.id,
          email: user.email,
          name: user.name,
        }
      : null,
    status: 201,
  } as const;
}
