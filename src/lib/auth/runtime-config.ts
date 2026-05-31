import type { Provider } from 'next-auth/providers';
import Credentials from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import MicrosoftEntraId from 'next-auth/providers/microsoft-entra-id';
import { config } from '@/lib/config';
import { dbReady } from '@/lib/db';
import { userRepository } from '@/lib/db/repositories/user.repository';
import { createSampleResume } from '@/lib/db/sample-resume';
import { hashPasswordForAuth, normalizeEmail, verifyPasswordForAuth } from './password';

// ── OAuth provider registry ──────────────────────────────────────────────

export interface OAuthProviderMeta {
  id: string;
  name: string; // human-readable, e.g. "Google", "GitHub"
}

/** All supported OAuth providers. Add new entries here to make them available in the admin panel. */
export const OAUTH_PROVIDER_REGISTRY: Record<string, OAuthProviderMeta> = {
  google: {
    id: 'google',
    name: 'Google',
  },
  github: {
    id: 'github',
    name: 'GitHub',
  },
  'microsoft-entra-id': {
    id: 'microsoft-entra-id',
    name: 'Microsoft',
  },
} as const;

export type OAuthProviderId = keyof typeof OAUTH_PROVIDER_REGISTRY;

export function isOAuthProviderId(value: string): value is OAuthProviderId {
  return value in OAUTH_PROVIDER_REGISTRY;
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface OAuthProviderConfig {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
}

export interface GlobalAuthSettings {
  passwordLoginEnabled: boolean;
  passwordRegisterEnabled: boolean;
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
  passwordHash?: string | null;
};

function boolSetting(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function stringSetting(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

// ── Provider factory map ──────────────────────────────────────────────────

const oauthProviderFactories: Record<string, (config: OAuthProviderConfig) => Provider> = {
  google: (c) =>
    GoogleProvider({
      clientId: c.clientId,
      clientSecret: c.clientSecret,
    }),
  github: (c) =>
    GitHubProvider({
      clientId: c.clientId,
      clientSecret: c.clientSecret,
    }),
  'microsoft-entra-id': (c) =>
    MicrosoftEntraId({
      clientId: c.clientId,
      clientSecret: c.clientSecret,
    }),
};

// ── Settings ──────────────────────────────────────────────────────────────

/**
 * Read persisted DB settings (set via admin panel).
 * OAuth providers are purely backend-configured — no env var overrides.
 * Migrates legacy flat keys (`googleLoginEnabled`, `googleClientId`, …) to
 * the new `providers` structure on first read.
 */
export async function getGlobalAuthSettings(): Promise<GlobalAuthSettings> {
  await dbReady;
  const rawSettings = await userRepository.getGlobalSettings();

  // Migrate legacy Google flat keys → providers.google
  let dbProviders: Record<string, unknown> | undefined;
  if (rawSettings.providers && typeof rawSettings.providers === 'object' && !Array.isArray(rawSettings.providers)) {
    dbProviders = rawSettings.providers as Record<string, unknown>;
  } else {
    dbProviders = {};
    if (rawSettings.googleLoginEnabled !== undefined || rawSettings.googleClientId !== undefined) {
      dbProviders.google = {
        enabled: rawSettings.googleLoginEnabled,
        clientId: rawSettings.googleClientId || '',
        clientSecret: rawSettings.googleClientSecret || '',
      };
    }
  }

  const providers: Record<string, OAuthProviderConfig> = {};

  for (const meta of Object.values(OAUTH_PROVIDER_REGISTRY)) {
    const dbProvider =
      dbProviders && dbProviders[meta.id] && typeof dbProviders[meta.id] === 'object'
        ? (dbProviders[meta.id] as Record<string, unknown>)
        : {};

    providers[meta.id] = {
      enabled: boolSetting(dbProvider.enabled, false),
      clientId: stringSetting(dbProvider.clientId, ''),
      clientSecret: stringSetting(dbProvider.clientSecret, ''),
    };
  }

  return {
    passwordLoginEnabled: boolSetting(
      rawSettings.passwordLoginEnabled,
      process.env.AUTH_PASSWORD_ENABLED !== 'false'
    ),
    passwordRegisterEnabled: boolSetting(
      rawSettings.passwordRegisterEnabled,
      process.env.AUTH_PASSWORD_REGISTER_ENABLED !== 'false'
    ),
    providers,
  };
}

/** Returns only the public-safe subset for the login dialog. */
export async function getPublicAuthProviders(): Promise<PublicAuthProviderConfig[]> {
  const settings = await getGlobalAuthSettings();

  const result: PublicAuthProviderConfig[] = [
    {
      id: 'password',
      enabled: settings.passwordLoginEnabled || settings.passwordRegisterEnabled,
      loginEnabled: settings.passwordLoginEnabled,
      registerEnabled: settings.passwordRegisterEnabled,
    },
  ];

  for (const [providerId, providerConfig] of Object.entries(settings.providers)) {
    if (providerConfig.enabled && providerConfig.clientId && providerConfig.clientSecret) {
      const meta = OAUTH_PROVIDER_REGISTRY[providerId];
      result.push({
        id: providerId,
        enabled: true,
        name: meta?.name || providerId,
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
      if (!settings.passwordLoginEnabled) {
        return null;
      }

      const email = normalizeEmail(String(credentials?.email || ''));
      const password = String(credentials?.password || '');
      if (!email || !password) return null;

      const dbUser = await userRepository.findByEmail(email);
      if (!dbUser || !(await verifyPasswordForAuth(password, (dbUser as AuthDbUser).passwordHash))) {
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
  const passwordProvider = await createPasswordProvider();
  const settings = await getGlobalAuthSettings();
  const providers: Provider[] = [passwordProvider];

  for (const [providerId, providerConfig] of Object.entries(settings.providers)) {
    if (!providerConfig.enabled || !providerConfig.clientId || !providerConfig.clientSecret) continue;

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
    role: hasAdmin ? 'user' : 'admin',
  });

  if (user) {
    await createSampleResume(user.id);
  }

  return {
    loginEnabled: settings.passwordLoginEnabled,
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
