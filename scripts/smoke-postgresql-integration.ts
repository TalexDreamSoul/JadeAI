import { db, dbReady } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { DurableLoginFailureRateLimiter } from '@/lib/auth/login-rate-limit-store';
import { walletRepository } from '@/lib/db/repositories/commercial.repository';
import { jobApplicationRepository } from '@/lib/db/repositories/job-application.repository';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertTestDatabase() {
  const databaseUrl = process.env.DATABASE_URL || '';
  assert(process.env.NODE_ENV === 'test', 'PostgreSQL integration requires NODE_ENV=test');
  assert(process.env.ALLOW_POSTGRES_INTEGRATION_TESTS === 'true', 'PostgreSQL integration requires explicit opt-in');
  assert(process.env.DB_TYPE === 'postgresql', 'PostgreSQL integration requires DB_TYPE=postgresql');
  const databaseName = new URL(databaseUrl).pathname.replace(/^\//, '');
  assert(databaseName.endsWith('_test'), 'PostgreSQL integration database name must end with _test');
}

async function main() {
  assertTestDatabase();
  await dbReady;
  const userId = `pg-smoke-${crypto.randomUUID()}`;
  await db.insert(users).values({
    id: userId,
    fingerprint: userId,
    authType: 'fingerprint',
    name: 'PostgreSQL Smoke User',
    aiCredits: 0,
  });

  const limiter = new DurableLoginFailureRateLimiter();
  const rateConfig = { maxAttempts: 2, windowMs: 60_000, maxTrackedKeys: 100 };
  const rateKey = `198.51.100.10:${userId}@example.test`;
  await limiter.recordFailure(rateKey, rateConfig, 1_000);
  await limiter.recordFailure(rateKey, rateConfig, 1_100);
  assert(await limiter.isLimited(rateKey, rateConfig, 1_200), 'PostgreSQL durable rate limit should persist failures');
  await limiter.clear(rateKey);

  await walletRepository.ensureAccount(userId, 'PG_TEST', 10);
  await walletRepository.credit({
    userId,
    currency: 'PG_TEST',
    amount: 5,
    source: 'pg_smoke',
    sourceId: 'credit-once',
  });
  await walletRepository.credit({
    userId,
    currency: 'PG_TEST',
    amount: 5,
    source: 'pg_smoke',
    sourceId: 'credit-once',
  });
  const account = await walletRepository.findAccount(userId, 'PG_TEST');
  assert(Number(account?.balance) === 15, `PostgreSQL wallet idempotency failed: ${account?.balance}`);

  const application = await jobApplicationRepository.create(userId, {
    companyName: 'PostgreSQL Test Company',
    jobTitle: 'Integration Engineer',
    stage: 'applied',
    result: 'pending',
  });
  assert(application?.companyName === 'PostgreSQL Test Company', 'PostgreSQL application create failed');
  const page = await jobApplicationRepository.list({ userId, page: 1, pageSize: 10, stage: 'applied' });
  assert(page.total === 1 && page.items[0]?.id === application.id, 'PostgreSQL application list failed');
  const updated = await jobApplicationRepository.update(application.id, userId, { stage: 'interview' });
  assert(updated?.stage === 'interview', 'PostgreSQL application update failed');
  assert(await jobApplicationRepository.delete(application.id, userId), 'PostgreSQL application delete failed');

  console.log('[smoke] PostgreSQL migrations and core integration passed');
}

main().catch((error) => {
  console.error('[smoke] PostgreSQL integration failed');
  console.error(error);
  process.exit(1);
});
