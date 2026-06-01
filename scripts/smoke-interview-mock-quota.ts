import { dbReady, db } from '@/lib/db';
import { users, interviewSessions } from '@/lib/db/schema';
import { entitlementRepository } from '@/lib/db/repositories/commercial.repository';
import {
  assertCanCreateInterviewMock,
  getInterviewMockQuota,
  InterviewMockQuotaExceededError,
} from '@/lib/commercial/interview-mock-quota-service';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function daysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

async function createSmokeUser() {
  const userId = `smoke-interview-quota-${crypto.randomUUID()}`;
  await db.insert(users).values({
    id: userId,
    fingerprint: userId,
    authType: 'fingerprint',
    name: 'Smoke Interview Quota',
  });
  return userId;
}

async function createSession(userId: string, createdAt: Date) {
  await db.insert(interviewSessions).values({
    id: crypto.randomUUID(),
    userId,
    jobDescription: 'Smoke JD',
    jobTitle: 'Smoke Engineer',
    selectedInterviewers: [],
    createdAt,
    updatedAt: createdAt,
  });
}

async function main() {
  await dbReady;

  const userId = await createSmokeUser();
  await getInterviewMockQuota(userId);

  const beforeExtra = new Date(Date.now() - 5 * 60 * 1000);
  await createSession(userId, beforeExtra);

  let quota = await getInterviewMockQuota(userId);
  assert(quota.monthly === 1, `expected free monthly quota to be 1, got ${quota.monthly}`);
  assert(quota.remaining === 0, `expected monthly quota to be exhausted, got ${quota.remaining}`);

  await entitlementRepository.grant({
    userId,
    key: 'interview.mock.extra_count',
    value: 3,
    source: 'smoke',
    sourceId: `${userId}:extra-pack`,
    expiresAt: daysFromNow(30),
  });

  quota = await getInterviewMockQuota(userId);
  assert(quota.extra === 3, `expected extra quota to be 3, got ${quota.extra}`);
  assert(quota.monthlyUsed === 1, `expected monthly used to be 1, got ${quota.monthlyUsed}`);
  assert(quota.extraUsed === 0, `expected pre-purchase sessions not to consume extra quota, got ${quota.extraUsed}`);
  assert(quota.extraRemaining === 3, `expected extra remaining to be 3, got ${quota.extraRemaining}`);
  assert(quota.remaining === 3, `expected total remaining to be 3, got ${quota.remaining}`);
  await assertCanCreateInterviewMock(userId);

  const afterExtra = new Date(Date.now() + 1000);
  await createSession(userId, afterExtra);
  await createSession(userId, afterExtra);
  await createSession(userId, afterExtra);

  quota = await getInterviewMockQuota(userId);
  assert(quota.extraUsed === 3, `expected extra used to be 3, got ${quota.extraUsed}`);
  assert(quota.remaining === 0, `expected quota to be exhausted, got ${quota.remaining}`);

  await entitlementRepository.grant({
    userId,
    key: 'interview.mock.extra_count',
    value: 2,
    source: 'smoke',
    sourceId: `${userId}:second-extra-pack`,
    expiresAt: daysFromNow(30),
  });

  quota = await getInterviewMockQuota(userId);
  assert(quota.extra === 5, `expected total extra quota to be 5, got ${quota.extra}`);
  assert(quota.extraUsed === 3, `expected earlier sessions not to consume second extra pack, got ${quota.extraUsed}`);
  assert(quota.extraRemaining === 2, `expected second extra pack to add 2 remaining, got ${quota.extraRemaining}`);
  await assertCanCreateInterviewMock(userId);

  const afterSecondExtra = new Date(Date.now() + 2000);
  await createSession(userId, afterSecondExtra);
  await createSession(userId, afterSecondExtra);

  quota = await getInterviewMockQuota(userId);
  assert(quota.extraUsed === 5, `expected all extra quota to be consumed, got ${quota.extraUsed}`);
  assert(quota.remaining === 0, `expected quota to be exhausted again, got ${quota.remaining}`);

  let exceeded = false;
  try {
    await assertCanCreateInterviewMock(userId);
  } catch (error) {
    exceeded = error instanceof InterviewMockQuotaExceededError;
  }
  assert(exceeded, 'expected exhausted quota to throw InterviewMockQuotaExceededError');

  const expiredUserId = await createSmokeUser();
  await entitlementRepository.grant({
    userId: expiredUserId,
    key: 'interview.mock.extra_count',
    value: 5,
    source: 'smoke',
    sourceId: `${expiredUserId}:expired-extra-pack`,
    expiresAt: daysFromNow(-1),
  });
  const expiredQuota = await getInterviewMockQuota(expiredUserId);
  assert(expiredQuota.extra === 0, `expected expired extra quota to be ignored, got ${expiredQuota.extra}`);

  console.log('[smoke] interview mock quota passed');
}

main().catch((error) => {
  console.error('[smoke] interview mock quota failed');
  console.error(error);
  process.exit(1);
});
