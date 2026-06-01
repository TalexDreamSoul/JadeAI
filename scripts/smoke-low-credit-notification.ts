import { dbReady, db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { WALLET_CURRENCY_AI_CREDIT } from '@/lib/commercial/catalog';
import { walletRepository } from '@/lib/db/repositories/commercial.repository';
import { notificationRepository } from '@/lib/db/repositories/notification.repository';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  await dbReady;

  const userId = `smoke-low-credit-${crypto.randomUUID()}`;
  await db.insert(users).values({
    id: userId,
    fingerprint: userId,
    authType: 'fingerprint',
    name: 'Smoke Low Credit User',
    aiCredits: 0,
  });
  await walletRepository.ensureAccount(userId, WALLET_CURRENCY_AI_CREDIT, 0);

  const first = await notificationRepository.listForUser(userId, 20);
  const lowCredit = first.filter((item) => item.type === 'notification_low_credits');
  assert(lowCredit.length === 1, `expected one low credit notification, got ${lowCredit.length}`);
  assert(lowCredit[0].status === 'unread', `expected unread low credit notification, got ${lowCredit[0].status}`);

  const second = await notificationRepository.listForUser(userId, 20);
  const secondLowCredit = second.filter((item) => item.type === 'notification_low_credits');
  assert(secondLowCredit.length === 1, `expected low credit notification to be deduped, got ${secondLowCredit.length}`);
  assert(secondLowCredit[0].id === lowCredit[0].id, 'expected same low credit notification id after repeated list');

  await notificationRepository.markRead(userId, [lowCredit[0].id]);
  const afterRead = await notificationRepository.listForUser(userId, 20);
  const afterReadLowCredit = afterRead.filter((item) => item.type === 'notification_low_credits');
  assert(afterReadLowCredit.length === 1, `expected read low credit notification to remain single, got ${afterReadLowCredit.length}`);
  assert(afterReadLowCredit[0].status === 'read', `expected low credit notification to stay read, got ${afterReadLowCredit[0].status}`);

  console.log('[smoke] low credit notification passed');
}

main().catch((error) => {
  console.error('[smoke] low credit notification failed');
  console.error(error);
  process.exit(1);
});
