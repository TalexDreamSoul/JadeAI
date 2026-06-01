import { dbReady, db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { WALLET_CURRENCY_AI_CREDIT } from '@/lib/commercial/catalog';
import { ensureUserCommercialDefaults } from '@/lib/commercial/bootstrap';
import {
  completeAIUsage,
  refundAIUsage,
  reserveAIUsage,
} from '@/lib/commercial/ai-metering-service';
import {
  aiUsageRepository,
  walletRepository,
} from '@/lib/db/repositories/commercial.repository';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function createSmokeUser() {
  const userId = `smoke-ai-metering-${crypto.randomUUID()}`;
  await db.insert(users).values({
    id: userId,
    fingerprint: userId,
    authType: 'fingerprint',
    name: 'Smoke AI Metering User',
    aiCredits: 0,
  });
  return userId;
}

async function balance(userId: string) {
  const account = await walletRepository.findAccount(userId, WALLET_CURRENCY_AI_CREDIT);
  return Number(account?.balance || 0);
}

async function main() {
  await dbReady;

  const userId = await createSmokeUser();
  await walletRepository.credit({
    userId,
    currency: WALLET_CURRENCY_AI_CREDIT,
    amount: 5,
    source: 'smoke',
    sourceId: `${userId}:initial-ai-credits`,
    description: 'Smoke AI credits',
  });
  await ensureUserCommercialDefaults(userId, 0);
  const initialBalance = await balance(userId);

  const successReservation = await reserveAIUsage({
    userId,
    feature: 'smoke.success',
    aiConfig: { provider: 'openai', model: 'gpt-4o-mini', mode: 'server' },
    credits: 2,
    metadata: { smoke: true },
    legacyAiCredits: 0,
  });
  assert(successReservation, 'expected success reservation to be created');
  assert(await balance(userId) === initialBalance - 2, 'expected balance to debit reserved credits');

  await completeAIUsage(successReservation, {
    inputTokens: 11,
    outputTokens: 17,
    totalTokens: 28,
  }, { completed: true });
  const successLog = await aiUsageRepository.findById(successReservation.usageLogId);
  assert(successLog?.status === 'success', `expected success usage log, got ${successLog?.status}`);
  assert(successLog?.creditsCharged === 2, `expected 2 credits charged, got ${successLog?.creditsCharged}`);
  assert(successLog?.promptTokens === 11, `expected 11 prompt tokens, got ${successLog?.promptTokens}`);
  assert(successLog?.completionTokens === 17, `expected 17 completion tokens, got ${successLog?.completionTokens}`);
  assert(successLog?.totalTokens === 28, `expected 28 total tokens, got ${successLog?.totalTokens}`);

  const failedReservation = await reserveAIUsage({
    userId,
    feature: 'smoke.failure',
    aiConfig: { provider: 'openai', model: 'gpt-4o-mini', mode: 'server' },
    credits: 2,
    metadata: { smoke: true },
    legacyAiCredits: 0,
  });
  assert(failedReservation, 'expected failed reservation to be created');
  assert(await balance(userId) === initialBalance - 4, 'expected second reservation to debit credits');

  await refundAIUsage(failedReservation, new Error('Smoke stream construction failed'), { failed: true });
  assert(await balance(userId) === initialBalance - 2, 'expected refund to restore failed reservation credits');
  const failedLog = await aiUsageRepository.findById(failedReservation.usageLogId);
  assert(failedLog?.status === 'failed_refunded', `expected failed_refunded usage log, got ${failedLog?.status}`);
  assert(failedLog?.creditsCharged === 0, `expected refunded usage to charge 0 credits, got ${failedLog?.creditsCharged}`);
  assert(failedLog?.error === 'Smoke stream construction failed', `expected refund error message, got ${failedLog?.error}`);

  const currentBalance = await balance(userId);
  const insufficient = await reserveAIUsage({
    userId,
    feature: 'smoke.insufficient',
    aiConfig: { provider: 'openai', model: 'gpt-4o-mini', mode: 'server' },
    credits: currentBalance + 1,
    metadata: { smoke: true },
    legacyAiCredits: 0,
  });
  assert(insufficient === null, 'expected insufficient reservation to return null');
  const logs = await aiUsageRepository.listForUser(userId, 10);
  assert(
    logs.some((log: { feature: string; status: string }) => (
      log.feature === 'smoke.insufficient' && log.status === 'insufficient_credits'
    )),
    'expected insufficient credits usage log',
  );

  console.log('[smoke] ai metering ledger passed');
}

main().catch((error) => {
  console.error('[smoke] ai metering ledger failed');
  console.error(error);
  process.exit(1);
});
