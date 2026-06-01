import { dbReady, db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { WALLET_CURRENCY_AI_CREDIT } from '@/lib/commercial/catalog';
import { createCommercialOrder } from '@/lib/commercial/billing-service';
import { confirmCommercialPayment } from '@/lib/commercial/payment-service';
import { orderRepository, walletRepository } from '@/lib/db/repositories/commercial.repository';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  await dbReady;

  const userId = `smoke-paid-retry-${crypto.randomUUID()}`;
  await db.insert(users).values({
    id: userId,
    fingerprint: userId,
    authType: 'fingerprint',
    name: 'Smoke Paid Retry User',
    aiCredits: 0,
  });

  const order = await createCommercialOrder({
    userId,
    items: [{ sku: 'ai-credit-pack-100', quantity: 1 }],
    legacyAiCredits: 0,
  });
  assert(order, 'expected order to be created');
  const accountBeforeRetry = await walletRepository.findAccount(userId, WALLET_CURRENCY_AI_CREDIT);
  const initialBalance = Number(accountBeforeRetry?.balance || 0);

  await orderRepository.markPaid(order.id, {
    provider: 'mock',
    providerTradeNo: `smoke_${crypto.randomUUID()}`,
    rawPayload: { smoke: true },
  });

  const paidBeforeRetry = await orderRepository.findByIdForUser(order.id, userId);
  assert(paidBeforeRetry?.status === 'paid', `expected paid order before retry, got ${paidBeforeRetry?.status}`);
  assert(paidBeforeRetry.payments.length === 1, `expected one payment before retry, got ${paidBeforeRetry.payments.length}`);

  const confirmed = await confirmCommercialPayment({
    userId,
    orderId: order.id,
    provider: 'mock',
    rawPayload: { retry: true },
  });
  assert(confirmed?.status === 'fulfilled', `expected fulfilled order after retry, got ${confirmed?.status}`);
  assert(confirmed.payments.length === 1, `expected retry not to create extra payment, got ${confirmed.payments.length}`);

  const account = await walletRepository.findAccount(userId, WALLET_CURRENCY_AI_CREDIT);
  assert(
    Number(account?.balance || 0) === initialBalance + 100,
    `expected AI credits to increase by 100 after retry fulfillment, got ${account?.balance}`,
  );

  const confirmedAgain = await confirmCommercialPayment({
    userId,
    orderId: order.id,
    provider: 'mock',
    rawPayload: { retryAgain: true },
  });
  assert(confirmedAgain?.status === 'fulfilled', `expected idempotent fulfilled order, got ${confirmedAgain?.status}`);
  assert(confirmedAgain.payments.length === 1, `expected idempotent confirm not to create payment, got ${confirmedAgain.payments.length}`);

  const accountAfterSecondConfirm = await walletRepository.findAccount(userId, WALLET_CURRENCY_AI_CREDIT);
  assert(
    Number(accountAfterSecondConfirm?.balance || 0) === initialBalance + 100,
    `expected AI credits to stay at one pack grant, got ${accountAfterSecondConfirm?.balance}`,
  );

  console.log('[smoke] paid order fulfillment retry passed');
}

main().catch((error) => {
  console.error('[smoke] paid order fulfillment retry failed');
  console.error(error);
  process.exit(1);
});
