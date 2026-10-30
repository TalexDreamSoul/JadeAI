import { createHash } from 'node:crypto';
import { eq, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { authLoginAttempts } from '@/lib/db/schema';
import type { LoginRateLimitConfig } from './login-rate-limit';

function attemptId(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export class DurableLoginFailureRateLimiter {
  async isLimited(key: string, config: LoginRateLimitConfig, now = Date.now()): Promise<boolean> {
    const id = attemptId(key);
    const rows = await db
      .select({ failures: authLoginAttempts.failures, resetAt: authLoginAttempts.resetAt })
      .from(authLoginAttempts)
      .where(eq(authLoginAttempts.id, id))
      .limit(1);
    const entry = rows[0];
    if (!entry) return false;
    if (entry.resetAt <= now) {
      await db.delete(authLoginAttempts).where(eq(authLoginAttempts.id, id));
      return false;
    }
    return entry.failures >= config.maxAttempts;
  }

  async recordFailure(key: string, config: LoginRateLimitConfig, now = Date.now()): Promise<void> {
    const id = attemptId(key);
    const resetAt = now + config.windowMs;
    await db
      .insert(authLoginAttempts)
      .values({ id, failures: 1, resetAt, updatedAt: now })
      .onConflictDoUpdate({
        target: authLoginAttempts.id,
        set: {
          failures: sql`case when ${authLoginAttempts.resetAt} > ${now} then ${authLoginAttempts.failures} + 1 else 1 end`,
          resetAt: sql`case when ${authLoginAttempts.resetAt} > ${now} then ${authLoginAttempts.resetAt} else ${resetAt} end`,
          updatedAt: now,
        },
      });

    if (Math.random() < 0.01) {
      await db.delete(authLoginAttempts).where(lte(authLoginAttempts.resetAt, now));
    }
  }

  async clear(key: string): Promise<void> {
    await db.delete(authLoginAttempts).where(eq(authLoginAttempts.id, attemptId(key)));
  }
}

export const durablePasswordLoginFailureLimiter = new DurableLoginFailureRateLimiter();
