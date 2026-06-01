import { NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { GET as getQuestionBank } from '@/app/api/interview/question-banks/[bankId]/route';
import { POST as favoriteQuestion } from '@/app/api/interview/question-banks/[bankId]/questions/[questionId]/favorite/route';
import { POST as practiceQuestion } from '@/app/api/interview/question-banks/[bankId]/questions/[questionId]/practice/route';
import { GET as getPracticeDashboard } from '@/app/api/interview/practice/route';
import { dbReady, db } from '@/lib/db';
import {
  interviewQuestionBanks,
  interviewQuestions,
  userEntitlements,
  users,
} from '@/lib/db/schema';
import {
  createCommercialOrder,
  ensureQuestionBankProduct,
} from '@/lib/commercial/billing-service';
import { confirmCommercialPayment } from '@/lib/commercial/payment-service';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function createSmokeUser(prefix: string) {
  const userId = `${prefix}-${crypto.randomUUID()}`;
  await db.insert(users).values({
    id: userId,
    fingerprint: userId,
    authType: 'fingerprint',
    name: 'Smoke Question Bank User',
    aiCredits: 0,
  });
  return userId;
}

async function createPremiumQuestionBank() {
  const bankId = `smoke-question-bank-${crypto.randomUUID()}`;
  const questionId = `smoke-question-${crypto.randomUUID()}`;
  await db.insert(interviewQuestionBanks).values({
    id: bankId,
    key: `smoke-bank-${crypto.randomUUID()}`,
    title: 'Smoke 高级面试题库',
    description: '验证面试题库商品化授权和练习记录。',
    industry: '互联网',
    role: '后端工程师',
    level: 'senior',
    companyType: '互联网',
    accessLevel: 'premium',
    active: true,
    metadata: { smoke: true },
  });
  await db.insert(interviewQuestions).values({
    id: questionId,
    bankId,
    dimension: 'system_design',
    difficulty: 'hard',
    questionType: 'scenario',
    prompt: '如何设计一个带有幂等和退款能力的 AI 计费系统？',
    referenceAnswer: '需要账本、幂等键、预扣、确认、失败退款和审计日志。',
    rubric: {
      excellent: '覆盖账本、事务、幂等、补偿和审计。',
      pass: '能说明扣费、失败退款和日志记录。',
    },
    keywords: ['账本', '幂等', '退款', '审计'],
    followUpStrategy: { askForRaceCondition: true },
    metadata: { smoke: true },
  });
  return { bankId, questionId };
}

function request(userId: string, url: string, init?: {
  method?: string;
  body?: BodyInit | null;
  headers?: Record<string, string>;
}) {
  return new NextRequest(url, {
    ...init,
    headers: {
      'x-fingerprint': userId,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
  });
}

async function purchasedEntitlements(userId: string, bankId: string) {
  return db
    .select()
    .from(userEntitlements)
    .where(and(
      eq(userEntitlements.userId, userId),
      eq(userEntitlements.key, 'interview_question_bank.download'),
      eq(userEntitlements.resourceType, 'interview_question_bank'),
      eq(userEntitlements.resourceId, bankId),
      eq(userEntitlements.source, 'order'),
    ));
}

async function main() {
  await dbReady;

  const userId = await createSmokeUser('smoke-question-bank-buyer');
  const { bankId, questionId } = await createPremiumQuestionBank();

  const locked = await getQuestionBank(
    request(userId, `http://localhost/api/interview/question-banks/${bankId}`),
    { params: Promise.resolve({ bankId }) },
  );
  assert(locked.status === 402, `expected locked question bank to return 402, got ${locked.status}`);
  const lockedPayload = await locked.json();
  assert(lockedPayload.code === 'content_payment_required', `expected payment required code, got ${lockedPayload.code}`);
  assert(lockedPayload.product?.resourceType === 'interview_question_bank', `expected question bank product, got ${lockedPayload.product?.resourceType}`);
  assert(lockedPayload.product?.resourceId === bankId, `expected product resourceId ${bankId}, got ${lockedPayload.product?.resourceId}`);

  const product = await ensureQuestionBankProduct({
    bankId,
    bankKey: `smoke-bank-${bankId}`,
    title: 'Smoke 高级面试题库',
    description: 'Smoke interview question bank product',
    accessLevel: 'premium',
    questionCount: 1,
  });
  assert(product?.id, 'expected question bank product to exist');

  const order = await createCommercialOrder({
    userId,
    items: [{ productId: product.id, quantity: 1 }],
    source: 'smoke',
    metadata: { smoke: true },
    legacyAiCredits: 0,
  });
  const paidOrder = await confirmCommercialPayment({
    userId,
    orderId: order.id,
    provider: 'mock',
    rawPayload: { smoke: true },
  });
  assert(paidOrder?.status === 'fulfilled', `expected fulfilled order, got ${paidOrder?.status}`);

  const entitlements = await purchasedEntitlements(userId, bankId);
  assert(entitlements.length === 1, `expected one question bank entitlement, got ${entitlements.length}`);

  const unlocked = await getQuestionBank(
    request(userId, `http://localhost/api/interview/question-banks/${bankId}`),
    { params: Promise.resolve({ bankId }) },
  );
  assert(unlocked.status === 200, `expected unlocked question bank to return 200, got ${unlocked.status}`);
  const unlockedPayload = await unlocked.json();
  assert(unlockedPayload.unlocked === true, 'expected question bank to be unlocked');
  assert(unlockedPayload.questions?.length === 1, `expected one question, got ${unlockedPayload.questions?.length}`);

  const favorite = await favoriteQuestion(
    request(userId, `http://localhost/api/interview/question-banks/${bankId}/questions/${questionId}/favorite`, {
      method: 'POST',
      body: JSON.stringify({ favorite: true, source: 'smoke' }),
    }),
    { params: Promise.resolve({ bankId, questionId }) },
  );
  assert(favorite.status === 200, `expected favorite to return 200, got ${favorite.status}`);
  const favoritePayload = await favorite.json();
  assert(favoritePayload.favorite === true, 'expected question to be favorited');

  const practice = await practiceQuestion(
    request(userId, `http://localhost/api/interview/question-banks/${bankId}/questions/${questionId}/practice`, {
      method: 'POST',
      body: JSON.stringify({ answer: '我会先看业务需求，然后写代码实现。' }),
    }),
    { params: Promise.resolve({ bankId, questionId }) },
  );
  assert(practice.status === 201, `expected practice to return 201, got ${practice.status}`);
  const practicePayload = await practice.json();
  assert(practicePayload.attempt?.id, 'expected practice attempt to be created');
  assert(practicePayload.stats?.attemptCount === 1, `expected attempt count 1, got ${practicePayload.stats?.attemptCount}`);

  const dashboard = await getPracticeDashboard(
    request(userId, 'http://localhost/api/interview/practice?limit=10'),
  );
  assert(dashboard.status === 200, `expected practice dashboard to return 200, got ${dashboard.status}`);
  const dashboardPayload = await dashboard.json();
  assert(dashboardPayload.attempts?.length === 1, `expected one practice attempt, got ${dashboardPayload.attempts?.length}`);
  assert(dashboardPayload.favorites?.length === 1, `expected one favorite, got ${dashboardPayload.favorites?.length}`);
  assert(dashboardPayload.wrongQuestions?.length === 1, `expected one wrong question, got ${dashboardPayload.wrongQuestions?.length}`);

  console.log('[smoke] interview question bank commerce passed');
}

main().catch((error) => {
  console.error('[smoke] interview question bank commerce failed');
  console.error(error);
  process.exit(1);
});
