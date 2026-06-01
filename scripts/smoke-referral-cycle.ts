import { dbReady, db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { WALLET_CURRENCY_POINT } from '@/lib/commercial/catalog';
import { bindReferral } from '@/lib/commercial/growth-service';
import { referralRepository, walletRepository } from '@/lib/db/repositories/commercial.repository';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function referralCode(userId: string) {
  return Buffer.from(userId).toString('base64url');
}

async function createSmokeUser(label: string) {
  const userId = `smoke-referral-${label}-${crypto.randomUUID()}`;
  await db.insert(users).values({
    id: userId,
    fingerprint: userId,
    authType: 'fingerprint',
    name: `Smoke Referral ${label}`,
    aiCredits: 0,
  });
  return userId;
}

async function pointBalance(userId: string) {
  const account = await walletRepository.findAccount(userId, WALLET_CURRENCY_POINT);
  return Number(account?.balance || 0);
}

async function main() {
  await dbReady;

  const inviterUserId = await createSmokeUser('inviter');
  const inviteeUserId = await createSmokeUser('invitee');

  const first = await bindReferral({
    inviteeUserId,
    code: referralCode(inviterUserId),
  });
  assert(first.relation.inviterUserId === inviterUserId, 'expected first relation inviter to match');
  assert(first.relation.inviteeUserId === inviteeUserId, 'expected first relation invitee to match');

  const inviterPointsAfterFirstBind = await pointBalance(inviterUserId);
  const inviteePointsAfterFirstBind = await pointBalance(inviteeUserId);
  assert(inviterPointsAfterFirstBind > 0, 'expected inviter reward points');
  assert(inviteePointsAfterFirstBind > 0, 'expected invitee reward points');

  let rejected = false;
  try {
    await bindReferral({
      inviteeUserId: inviterUserId,
      code: referralCode(inviteeUserId),
    });
  } catch (error) {
    rejected = error instanceof Error && error.message === '不能绑定下级用户的邀请码';
  }
  assert(rejected, 'expected reverse referral cycle to be rejected');

  const reverseRelations = await referralRepository.listForInvitee(inviterUserId, 10);
  assert(reverseRelations.length === 0, `expected no reverse relation, got ${reverseRelations.length}`);
  assert(await pointBalance(inviterUserId) === inviterPointsAfterFirstBind, 'expected inviter points unchanged after rejected reverse bind');
  assert(await pointBalance(inviteeUserId) === inviteePointsAfterFirstBind, 'expected invitee points unchanged after rejected reverse bind');

  console.log('[smoke] referral cycle guard passed');
}

main().catch((error) => {
  console.error('[smoke] referral cycle guard failed');
  console.error(error);
  process.exit(1);
});
