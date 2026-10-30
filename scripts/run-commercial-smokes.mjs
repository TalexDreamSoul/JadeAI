import { spawnSync } from 'node:child_process';

const smokeScripts = [
  'scripts/smoke-ai-json-usage.ts',
  'scripts/smoke-ai-metering-ledger.ts',
  'scripts/smoke-interview-mock-quota.ts',
  'scripts/smoke-share-download-entitlement.ts',
  'scripts/smoke-job-template-download-entitlement.ts',
  'scripts/smoke-interview-question-bank-commerce.ts',
  'scripts/smoke-points-exchange.ts',
  'scripts/smoke-referral-cycle.ts',
  'scripts/smoke-low-credit-notification.ts',
  'scripts/smoke-paid-order-fulfillment-retry.ts',
  'scripts/smoke-commercial-transaction-atomicity.ts',
  'scripts/smoke-secret-encryption-at-rest.ts',
  'scripts/smoke-durable-login-rate-limit.ts',
];

for (const script of smokeScripts) {
  const result = spawnSync('pnpm', ['exec', 'tsx', script], {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DB_TYPE: 'sqlite',
      SQLITE_PATH: ':memory:',
      AUTH_ENABLED: 'false',
      AUTH_SECRET: 'commercial-smoke-only-secret',
      DATA_ENCRYPTION_KEY: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
      ALLOW_MOCK_PAYMENTS: 'true',
    },
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`[smoke] ${smokeScripts.length} commercial scenarios passed`);
