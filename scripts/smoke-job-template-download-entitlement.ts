import { NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { GET as downloadJobTemplate } from '@/app/api/career/job-templates/[id]/download/route';
import { dbReady, db } from '@/lib/db';
import { jobTemplates, userEntitlements, users } from '@/lib/db/schema';
import { createCommercialOrder } from '@/lib/commercial/billing-service';
import { confirmCommercialPayment } from '@/lib/commercial/payment-service';
import { ensureJobTemplateProduct } from '@/lib/commercial/billing-service';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function createSmokeUser(prefix: string, role: 'user' | 'admin' = 'user') {
  const userId = `${prefix}-${crypto.randomUUID()}`;
  await db.insert(users).values({
    id: userId,
    fingerprint: userId,
    authType: 'fingerprint',
    name: 'Smoke Job Template User',
    role,
    aiCredits: 0,
  });
  return userId;
}

async function createPublicJobTemplate(ownerUserId: string) {
  const id = `smoke-job-template-${crypto.randomUUID()}`;
  await db.insert(jobTemplates).values({
    id,
    ownerUserId,
    roleKey: `smoke-role-${crypto.randomUUID()}`,
    title: 'Smoke 商业化职位模板',
    level: 'mid',
    industry: 'Smoke Industry',
    jd: '负责验证职位模板付费下载链路。',
    keywords: ['commercial', 'job-template'],
    interviewQuestions: ['如何设计内容商品授权？'],
    recommendedSections: ['项目经历', '技能特长'],
    enabled: true,
    sortOrder: 1,
  });
  return id;
}

function downloadRequest(userId: string, templateId: string) {
  return new NextRequest(`http://localhost/api/career/job-templates/${templateId}/download?format=md`, {
    headers: { 'x-fingerprint': userId },
  });
}

async function purchasedEntitlements(userId: string, templateId: string) {
  return db
    .select()
    .from(userEntitlements)
    .where(and(
      eq(userEntitlements.userId, userId),
      eq(userEntitlements.key, 'job_template.download'),
      eq(userEntitlements.resourceType, 'job_template'),
      eq(userEntitlements.resourceId, templateId),
      eq(userEntitlements.source, 'order'),
    ));
}

async function main() {
  await dbReady;

  const ownerUserId = await createSmokeUser('smoke-job-template-owner', 'admin');
  const buyerUserId = await createSmokeUser('smoke-job-template-buyer');
  const templateId = await createPublicJobTemplate(ownerUserId);

  const locked = await downloadJobTemplate(
    downloadRequest(buyerUserId, templateId),
    { params: Promise.resolve({ id: templateId }) },
  );
  assert(locked.status === 402, `expected locked download to return 402, got ${locked.status}`);
  const lockedPayload = await locked.json();
  assert(lockedPayload.code === 'content_payment_required', `expected payment required code, got ${lockedPayload.code}`);
  assert(lockedPayload.product?.resourceType === 'job_template', `expected job_template product, got ${lockedPayload.product?.resourceType}`);
  assert(lockedPayload.product?.resourceId === templateId, `expected product resourceId ${templateId}, got ${lockedPayload.product?.resourceId}`);

  const product = await ensureJobTemplateProduct({
    jobTemplateId: templateId,
    name: 'Smoke 商业化职位模板',
    description: 'Smoke job template product',
  });
  assert(product?.id, 'expected job template product to exist');

  const order = await createCommercialOrder({
    userId: buyerUserId,
    items: [{ productId: product.id, quantity: 1 }],
    source: 'smoke',
    metadata: { smoke: true },
    legacyAiCredits: 0,
  });
  assert(order?.status === 'pending_payment', `expected pending order, got ${order?.status}`);

  const paidOrder = await confirmCommercialPayment({
    userId: buyerUserId,
    orderId: order.id,
    provider: 'mock',
    rawPayload: { smoke: true },
  });
  assert(paidOrder?.status === 'fulfilled', `expected fulfilled order, got ${paidOrder?.status}`);

  const entitlements = await purchasedEntitlements(buyerUserId, templateId);
  assert(entitlements.length === 1, `expected one order entitlement, got ${entitlements.length}`);

  const unlocked = await downloadJobTemplate(
    downloadRequest(buyerUserId, templateId),
    { params: Promise.resolve({ id: templateId }) },
  );
  assert(unlocked.status === 200, `expected purchased download to return 200, got ${unlocked.status}`);
  assert(unlocked.headers.get('content-type')?.includes('text/markdown'), 'expected markdown download content type');
  const body = await unlocked.text();
  assert(body.includes('# Smoke 商业化职位模板'), 'expected downloaded markdown to include template title');
  assert(body.includes('负责验证职位模板付费下载链路。'), 'expected downloaded markdown to include JD');

  console.log('[smoke] job template download entitlement passed');
}

main().catch((error) => {
  console.error('[smoke] job template download entitlement failed');
  console.error(error);
  process.exit(1);
});
