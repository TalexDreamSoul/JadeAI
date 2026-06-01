import { and, eq } from 'drizzle-orm';
import { dbReady, db } from '@/lib/db';
import { notifications, userEntitlements, users } from '@/lib/db/schema';
import {
  WALLET_CURRENCY_AI_CREDIT,
  WALLET_CURRENCY_POINT,
} from '@/lib/commercial/catalog';
import {
  exchangePointsForBenefit,
  listPointsExchangeItems,
} from '@/lib/commercial/points-exchange-service';
import { entitlementValue } from '@/lib/commercial/json';
import { walletRepository } from '@/lib/db/repositories/commercial.repository';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function createSmokeUser(prefix: string) {
  const userId = `${prefix}-${crypto.randomUUID()}`;
  await db.insert(users).values({
    id: userId,
    fingerprint: userId,
    authType: 'fingerprint',
    name: 'Smoke Points Exchange User',
    aiCredits: 0,
  });
  return userId;
}

async function balance(userId: string, currency: string) {
  const account = await walletRepository.findAccount(userId, currency);
  return Number(account?.balance || 0);
}

async function pointsExchangeNotifications(userId: string) {
  return db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.type, 'points_exchange')));
}

async function pointExchangeEntitlements(userId: string, sourceId: string) {
  return db
    .select()
    .from(userEntitlements)
    .where(and(
      eq(userEntitlements.userId, userId),
      eq(userEntitlements.source, 'points_exchange'),
      eq(userEntitlements.sourceId, sourceId),
    ));
}

async function main() {
  await dbReady;

  const userId = await createSmokeUser('smoke-points-exchange');
  await walletRepository.credit({
    userId,
    currency: WALLET_CURRENCY_POINT,
    amount: 1000,
    source: 'smoke',
    sourceId: `${userId}:initial-points`,
    description: 'Smoke initial points',
  });
  await listPointsExchangeItems(userId);
  const aiCreditsBeforeExchange = await balance(userId, WALLET_CURRENCY_AI_CREDIT);

  const aiRequestId = `ai-${crypto.randomUUID()}`;
  const firstAiExchange = await exchangePointsForBenefit({
    userId,
    itemId: 'ai-credit-50',
    requestId: aiRequestId,
  });
  assert(!firstAiExchange.replayed, 'expected first AI credit exchange to apply');
  assert(firstAiExchange.cost === 500, `expected AI credit exchange cost 500, got ${firstAiExchange.cost}`);

  const replayedAiExchange = await exchangePointsForBenefit({
    userId,
    itemId: 'ai-credit-50',
    requestId: aiRequestId,
  });
  assert(replayedAiExchange.replayed, 'expected duplicate AI credit exchange to replay');
  assert(replayedAiExchange.sourceId === firstAiExchange.sourceId, 'expected duplicate AI exchange to reuse sourceId');
  assert(await balance(userId, WALLET_CURRENCY_POINT) === 500, 'expected points to be debited only once');
  assert(
    await balance(userId, WALLET_CURRENCY_AI_CREDIT) === aiCreditsBeforeExchange + 50,
    'expected AI credits to increase by one exchange reward only',
  );

  const aiNotifications = await pointsExchangeNotifications(userId);
  assert(aiNotifications.length === 1, `expected one exchange notification, got ${aiNotifications.length}`);

  const mockUserId = await createSmokeUser('smoke-points-exchange-mock');
  await walletRepository.credit({
    userId: mockUserId,
    currency: WALLET_CURRENCY_POINT,
    amount: 1000,
    source: 'smoke',
    sourceId: `${mockUserId}:initial-points`,
    description: 'Smoke initial points',
  });

  const mockRequestId = `mock-${crypto.randomUUID()}`;
  const firstMockExchange = await exchangePointsForBenefit({
    userId: mockUserId,
    itemId: 'interview-mock-3',
    requestId: mockRequestId,
  });
  assert(!firstMockExchange.replayed, 'expected first mock exchange to apply');
  assert(firstMockExchange.cost === 800, `expected mock exchange cost 800, got ${firstMockExchange.cost}`);

  const replayedMockExchange = await exchangePointsForBenefit({
    userId: mockUserId,
    itemId: 'interview-mock-3',
    requestId: mockRequestId,
  });
  assert(replayedMockExchange.replayed, 'expected duplicate mock exchange to replay');
  assert(replayedMockExchange.sourceId === firstMockExchange.sourceId, 'expected duplicate mock exchange to reuse sourceId');

  const entitlements = await pointExchangeEntitlements(mockUserId, firstMockExchange.sourceId);
  assert(entitlements.length === 1, `expected one mock entitlement, got ${entitlements.length}`);
  assert(entitlements[0].key === 'interview.mock.extra_count', `expected mock entitlement key, got ${entitlements[0].key}`);
  assert(entitlementValue(entitlements[0].value) === 3, `expected mock entitlement value 3, got ${entitlements[0].value}`);

  const mockNotifications = await pointsExchangeNotifications(mockUserId);
  assert(mockNotifications.length === 1, `expected one mock exchange notification, got ${mockNotifications.length}`);

  const poorUserId = await createSmokeUser('smoke-points-exchange-poor');
  let insufficient = false;
  try {
    await exchangePointsForBenefit({
      userId: poorUserId,
      itemId: 'ai-credit-50',
      requestId: `poor-${crypto.randomUUID()}`,
    });
  } catch (error) {
    insufficient = error instanceof Error && error.message === '积分不足，无法兑换';
  }
  assert(insufficient, 'expected insufficient points error');

  console.log('[smoke] points exchange passed');
}

main().catch((error) => {
  console.error('[smoke] points exchange failed');
  console.error(error);
  process.exit(1);
});
