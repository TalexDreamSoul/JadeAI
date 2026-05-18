import type { Provider } from 'next-auth/providers';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { config } from '@/lib/config';
import { dbReady } from '@/lib/db';
import { userRepository } from '@/lib/db/repositories/user.repository';
import { createSampleResume } from '@/lib/db/sample-resume';
import { hashPasswordForAuth, normalizeEmail, verifyPasswordForAuth } from './password';

export type AuthProviderId = 'password' | 'google';

export interface PublicAuthProviderConfig {
  id: AuthProviderId;
  enabled: boolean;
  loginEnabled?: boolean;
  registerEnabled?: boolean;
}

export interface GlobalAuthSettings {
  passwordLoginEnabled: boolean;
  passwordRegisterEnabled: boolean;
  googleLoginEnabled: boolean;
  googleClientId?: string;
  googleClientSecret?: string;
}

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

export function getEnvAuthSettings(): GlobalAuthSettings {
  return {
    passwordLoginEnabled: process.env.AUTH_PASSWORD_ENABLED !== 'false',
    passwordRegisterEnabled: process.env.AUTH_PASSWORD_REGISTER_ENABLED !== 'false',
    googleLoginEnabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  };
}

export async function getGlobalAuthSettings(): Promise<GlobalAuthSettings> {
  await dbReady;
  const settings = await userRepository.getGlobalSettings();
  const env = getEnvAuthSettings();

  return {
    passwordLoginEnabled: boolSetting(settings.passwordLoginEnabled, env.passwordLoginEnabled),
    passwordRegisterEnabled: boolSetting(settings.passwordRegisterEnabled, env.passwordRegisterEnabled),
    googleLoginEnabled: boolSetting(settings.googleLoginEnabled, env.googleLoginEnabled),
    googleClientId: stringSetting(settings.googleClientId, env.googleClientId),
    googleClientSecret: stringSetting(settings.googleClientSecret, env.googleClientSecret),
  };
}

export async function getPublicAuthProviders(): Promise<PublicAuthProviderConfig[]> {
  const settings = await getGlobalAuthSettings();
  return [
    {
      id: 'password',
      enabled: settings.passwordLoginEnabled || settings.passwordRegisterEnabled,
      loginEnabled: settings.passwordLoginEnabled,
      registerEnabled: settings.passwordRegisterEnabled,
    },
    { id: 'google', enabled: settings.googleLoginEnabled && !!settings.googleClientId && !!settings.googleClientSecret },
  ];
}

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

  if (settings.googleLoginEnabled && settings.googleClientId && settings.googleClientSecret) {
    providers.push(
      Google({
        clientId: settings.googleClientId,
        clientSecret: settings.googleClientSecret,
      })
    );
  }

  // Keep fingerprint sign-in available only as a compatibility fallback for old no-auth deployments.
  // UI no longer treats fingerprint as a cloud-authenticated user.
  if (!config.auth.enabled) {
    providers.push(createFingerprintProvider());
  }

  return providers;
}

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
