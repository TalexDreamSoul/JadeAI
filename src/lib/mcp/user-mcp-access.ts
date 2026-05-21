import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { dbReady } from '@/lib/db';
import { userRepository } from '@/lib/db/repositories/user.repository';

const SETTINGS_KEY = 'mcpAccess';
const TOKEN_PREFIX = 'jai_mcp_';
const TOKEN_BYTES = 32;
const TOKEN_PREVIEW_LENGTH = 14;

type SettingsRecord = Record<string, unknown>;

type StoredMcpAccess = {
  enabled: boolean;
  tokenHash: string;
  tokenPreview: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string | null;
};

export type PublicMcpAccess = {
  enabled: boolean;
  tokenPreview: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  lastUsedAt: string | null;
};

function isRecord(value: unknown): value is SettingsRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeAccess(value: unknown): StoredMcpAccess | null {
  if (!isRecord(value)) return null;
  if (value.enabled !== true) return null;
  if (typeof value.tokenHash !== 'string' || !value.tokenHash) return null;
  if (typeof value.tokenPreview !== 'string' || !value.tokenPreview) return null;

  return {
    enabled: true,
    tokenHash: value.tokenHash,
    tokenPreview: value.tokenPreview,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : '',
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : '',
    lastUsedAt: typeof value.lastUsedAt === 'string' ? value.lastUsedAt : null,
  };
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function previewToken(token: string) {
  return `${token.slice(0, TOKEN_PREVIEW_LENGTH)}...${token.slice(-4)}`;
}

function publicAccess(access: StoredMcpAccess | null): PublicMcpAccess {
  return {
    enabled: !!access,
    tokenPreview: access?.tokenPreview || null,
    createdAt: access?.createdAt || null,
    updatedAt: access?.updatedAt || null,
    lastUsedAt: access?.lastUsedAt || null,
  };
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function sanitizeMcpSettings(settings: SettingsRecord) {
  const { [SETTINGS_KEY]: raw, ...rest } = settings;
  const access = normalizeAccess(raw);
  return {
    ...rest,
    [SETTINGS_KEY]: publicAccess(access),
  };
}

export async function getUserMcpAccess(userId: string) {
  const settings = await userRepository.getSettings(userId);
  return publicAccess(normalizeAccess(settings[SETTINGS_KEY]));
}

export async function createUserMcpToken(userId: string) {
  const token = `${TOKEN_PREFIX}${randomBytes(TOKEN_BYTES).toString('base64url')}`;
  const now = new Date().toISOString();
  const access: StoredMcpAccess = {
    enabled: true,
    tokenHash: hashToken(token),
    tokenPreview: previewToken(token),
    createdAt: now,
    updatedAt: now,
    lastUsedAt: null,
  };

  await userRepository.updateSettings(userId, { [SETTINGS_KEY]: access });
  return {
    token,
    access: publicAccess(access),
  };
}

export async function revokeUserMcpToken(userId: string) {
  const settings = await userRepository.getSettings(userId);
  const next = { ...settings };
  delete next[SETTINGS_KEY];
  await userRepository.replaceSettings(userId, next);
  return publicAccess(null);
}

export async function resolveUserByMcpToken(token: string) {
  const normalized = token.trim();
  if (!normalized.startsWith(TOKEN_PREFIX)) return null;

  await dbReady;
  const tokenHash = hashToken(normalized);
  const users = await userRepository.list();
  for (const user of users) {
    const settings = await userRepository.getSettings(user.id);
    const access = normalizeAccess(settings[SETTINGS_KEY]);
    if (!access || !safeEqual(access.tokenHash, tokenHash)) continue;

    await userRepository.updateSettings(user.id, {
      [SETTINGS_KEY]: {
        ...access,
        lastUsedAt: new Date().toISOString(),
      },
    }).catch(() => null);
    return user;
  }

  return null;
}
