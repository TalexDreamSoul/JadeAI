import { db, dbReady } from '@/lib/db';
import { authLoginAttempts } from '@/lib/db/schema';
import { DurableLoginFailureRateLimiter } from '@/lib/auth/login-rate-limit-store';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  await dbReady;
  const limiter = new DurableLoginFailureRateLimiter();
  const config = { maxAttempts: 2, windowMs: 1_000, maxTrackedKeys: 100 };
  const key = '192.0.2.10:private-user@example.test';

  await limiter.recordFailure(key, config, 1_000);
  assert(!await limiter.isLimited(key, config, 1_100), 'one failure should remain below the limit');
  await limiter.recordFailure(key, config, 1_200);
  assert(await limiter.isLimited(key, config, 1_300), 'two failures should reach the limit');

  const rows = await db.select().from(authLoginAttempts);
  assert(rows.length === 1, `expected one durable limiter row, got ${rows.length}`);
  assert(!rows[0].id.includes('private-user'), 'durable limiter key must be hashed');

  await limiter.clear(key);
  assert(!await limiter.isLimited(key, config, 1_400), 'successful login should clear failures');

  await limiter.recordFailure(key, config, 2_000);
  assert(!await limiter.isLimited(key, config, 3_001), 'expired window should reset failures');
  console.log('[smoke] durable login rate limit passed');
}

main().catch((error) => {
  console.error('[smoke] durable login rate limit failed');
  console.error(error);
  process.exit(1);
});
