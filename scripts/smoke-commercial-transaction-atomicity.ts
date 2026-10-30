import { and, eq } from 'drizzle-orm';
import { db, dbReady, runInTransaction } from '@/lib/db';
import { orderRepository, walletRepository } from '@/lib/db/repositories/commercial.repository';
import { users, walletAccounts, walletTransactions } from '@/lib/db/schema';
import { createCommercialOrder } from '@/lib/commercial/billing-service';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  await dbReady;
  const userId = `smoke-transaction-${crypto.randomUUID()}`;
  await db.insert(users).values({
    id: userId,
    fingerprint: userId,
    authType: 'fingerprint',
    name: 'Smoke Transaction User',
    aiCredits: 0,
  });

  await walletRepository.ensureAccount(userId, 'ATOMIC_TEST', 10);
  const creditInput = {
    userId,
    currency: 'ATOMIC_TEST',
    amount: 5,
    source: 'smoke',
    sourceId: 'credit-once',
  };
  assert((await walletRepository.credit(creditInput)).applied, 'first credit should apply');
  assert(!(await walletRepository.credit(creditInput)).applied, 'duplicate credit should be idempotent');

  const debitInput = {
    userId,
    currency: 'ATOMIC_TEST',
    amount: 3,
    source: 'smoke',
    sourceId: 'debit-once',
  };
  assert((await walletRepository.debit(debitInput)).applied, 'first debit should apply');
  assert(!(await walletRepository.debit(debitInput)).applied, 'duplicate debit should be idempotent');

  const beforeRollback = await walletRepository.findAccount(userId, 'ATOMIC_TEST');
  assert(Number(beforeRollback?.balance) === 12, `expected balance 12, got ${beforeRollback?.balance}`);
  try {
    await runInTransaction(async (transaction) => {
      await transaction
        .update(walletAccounts)
        .set({ balance: 999 })
        .where(and(eq(walletAccounts.userId, userId), eq(walletAccounts.currency, 'ATOMIC_TEST')));
      throw new Error('intentional rollback');
    });
    throw new Error('rollback transaction unexpectedly succeeded');
  } catch (error) {
    assert(error instanceof Error && error.message === 'intentional rollback', 'expected intentional rollback error');
  }
  const afterRollback = await walletRepository.findAccount(userId, 'ATOMIC_TEST');
  assert(Number(afterRollback?.balance) === 12, 'failed transaction must not change wallet balance');

  const transactions = await db
    .select()
    .from(walletTransactions)
    .where(and(eq(walletTransactions.userId, userId), eq(walletTransactions.currency, 'ATOMIC_TEST')));
  assert(transactions.length === 2, `expected two committed wallet transactions, got ${transactions.length}`);

  const firstOrder = await createCommercialOrder({
    userId,
    items: [{ sku: 'ai-credit-pack-100', quantity: 1 }],
    legacyAiCredits: 0,
  });
  const secondOrder = await createCommercialOrder({
    userId,
    items: [{ sku: 'ai-credit-pack-100', quantity: 1 }],
    legacyAiCredits: 0,
  });
  assert(firstOrder && secondOrder, 'expected two orders');

  const providerTradeNo = `atomic_trade_${crypto.randomUUID()}`;
  await orderRepository.markPaid(firstOrder.id, { provider: 'mock', providerTradeNo });
  await orderRepository.markPaid(secondOrder.id, { provider: 'mock', providerTradeNo })
    .then(() => {
      throw new Error('duplicate provider trade unexpectedly succeeded');
    })
    .catch((error) => {
      assert(
        error instanceof Error && error.message === 'Payment transaction is already linked to another order',
        'expected duplicate provider trade rejection',
      );
    });
  const unchangedSecondOrder = await orderRepository.findById(secondOrder.id);
  assert(unchangedSecondOrder?.status === 'pending_payment', 'rejected payment must leave second order pending');

  console.log('[smoke] commercial transaction atomicity passed');
}

main().catch((error) => {
  console.error('[smoke] commercial transaction atomicity failed');
  console.error(error);
  process.exit(1);
});
