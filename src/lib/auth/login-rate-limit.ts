import { normalizeEmail } from './password';

export type LoginRateLimitConfig = {
  maxAttempts: number;
  windowMs: number;
  maxTrackedKeys: number;
};

type LoginRateLimitEnvironment = Record<string, string | undefined>;

type LoginFailureEntry = {
  failures: number;
  resetAt: number;
};

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_WINDOW_SECONDS = 15 * 60;
const DEFAULT_MAX_TRACKED_KEYS = 10_000;

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getPasswordLoginRateLimitConfig(
  env: LoginRateLimitEnvironment = process.env,
): LoginRateLimitConfig {
  return {
    maxAttempts: positiveInteger(env.AUTH_LOGIN_RATE_LIMIT_ATTEMPTS, DEFAULT_MAX_ATTEMPTS),
    windowMs: positiveInteger(env.AUTH_LOGIN_RATE_LIMIT_WINDOW_SECONDS, DEFAULT_WINDOW_SECONDS) * 1000,
    maxTrackedKeys: DEFAULT_MAX_TRACKED_KEYS,
  };
}

export function getPasswordLoginAttemptKey(email: string, request?: Request): string {
  const realIp = request?.headers.get('x-real-ip')?.trim();
  const forwardedIps = request?.headers.get('x-forwarded-for')
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const clientIp = realIp || forwardedIps?.at(-1) || 'unknown';
  return `${clientIp}:${normalizeEmail(email)}`;
}

export class LoginFailureRateLimiter {
  private readonly entries = new Map<string, LoginFailureEntry>();

  isLimited(key: string, config: LoginRateLimitConfig, now = Date.now()): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;
    if (entry.resetAt <= now) {
      this.entries.delete(key);
      return false;
    }
    return entry.failures >= config.maxAttempts;
  }

  recordFailure(key: string, config: LoginRateLimitConfig, now = Date.now()): void {
    const existing = this.entries.get(key);
    const entry = existing && existing.resetAt > now
      ? { failures: existing.failures + 1, resetAt: existing.resetAt }
      : { failures: 1, resetAt: now + config.windowMs };

    this.entries.delete(key);
    this.entries.set(key, entry);
    this.trim(config, now);
  }

  clear(key: string): void {
    this.entries.delete(key);
  }

  private trim(config: LoginRateLimitConfig, now: number): void {
    if (this.entries.size <= config.maxTrackedKeys) return;

    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) this.entries.delete(key);
    }
    while (this.entries.size > config.maxTrackedKeys) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey === undefined) break;
      this.entries.delete(oldestKey);
    }
  }
}

export const passwordLoginFailureLimiter = new LoginFailureRateLimiter();
