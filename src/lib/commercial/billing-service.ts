import { ensureCommercialCatalog, ensureUserCommercialDefaults } from './bootstrap';
import { PRODUCT_SEEDS, WALLET_CURRENCY_AI_CREDIT } from './catalog';
import { parseJsonObject } from './json';
import { grantReferralOrderCommission } from './growth-service';
import { grantMembershipMonthlyAICredits } from './membership-credit-service';
import {
  entitlementRepository,
  membershipRepository,
  notificationStoreRepository,
  orderRepository,
  productRepository,
  walletRepository,
} from '@/lib/db/repositories/commercial.repository';

type CreateOrderInput = {
  userId: string;
  items: Array<{ productId?: string; sku?: string; quantity?: number }>;
  source?: string;
  metadata?: Record<string, unknown>;
  legacyAiCredits?: number;
};

type FulfillmentNotice = {
  type: string;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
};

export async function listProducts() {
  await ensureCommercialCatalog();
  return productRepository.list(true);
}

export async function createCommercialOrder(input: CreateOrderInput) {
  await ensureUserCommercialDefaults(input.userId, input.legacyAiCredits || 0);
  const products = [];
  for (const item of input.items) {
    const product = item.productId
      ? await productRepository.findById(item.productId)
      : item.sku
        ? await productRepository.findBySku(item.sku)
        : null;
    if (!product) throw new Error('Product not found');
    products.push({ productId: product.id, quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)) });
  }
  if (!products.length) throw new Error('Order must contain at least one product');

  return orderRepository.create({
    userId: input.userId,
    products,
    source: input.source || 'web',
    metadata: input.metadata || {},
  });
}

export async function confirmMockPayment(input: {
  userId: string;
  orderId: string;
  rawPayload?: Record<string, unknown>;
}) {
  await ensureCommercialCatalog();
  const order = await orderRepository.findByIdForUser(input.orderId, input.userId);
  if (!order) throw new Error('Order not found');

  await markCommercialOrderPaid({
    userId: input.userId,
    orderId: input.orderId,
    provider: 'mock',
    rawPayload: input.rawPayload || {},
  });
  return orderRepository.findByIdForUser(input.orderId, input.userId);
}

export async function markCommercialOrderPaid(input: {
  userId: string;
  orderId: string;
  provider: string;
  providerTradeNo?: string;
  rawPayload?: Record<string, unknown>;
}) {
  const order = await orderRepository.findByIdForUser(input.orderId, input.userId);
  if (!order) throw new Error('Order not found');
  if (order.status === 'canceled') throw new Error('订单已取消，无法支付');

  await orderRepository.markPaid(input.orderId, {
    provider: input.provider,
    providerTradeNo: input.providerTradeNo,
    rawPayload: input.rawPayload || {},
  });
  await fulfillOrder(input.orderId, input.userId);
}

export async function cancelCommercialOrder(input: {
  userId: string;
  orderId: string;
  reason?: string;
}) {
  const order = await orderRepository.findByIdForUser(input.orderId, input.userId);
  if (!order) throw new Error('Order not found');
  if (order.status !== 'pending_payment') throw new Error('只有待支付订单可以取消');

  const canceled = await orderRepository.markCanceled(input.orderId, {
    cancelReason: input.reason || 'user_cancel',
    canceledAt: new Date().toISOString(),
  });
  await notificationStoreRepository.create({
    userId: input.userId,
    type: 'order_canceled',
    title: '订单已取消',
    description: `订单 ${order.orderNo} 已取消。`,
    actionUrl: '/zh/account',
    metadata: { orderId: input.orderId, reason: input.reason || 'user_cancel' },
  });

  return canceled;
}

export async function fulfillOrder(orderId: string, userId: string) {
  const order = await orderRepository.findById(orderId);
  if (!order) throw new Error('Order not found');
  if (order.status === 'fulfilled' || order.status === 'fulfilling') return;
  if (order.status !== 'paid') throw new Error('订单未支付，无法履约');
  const started = await orderRepository.startFulfillment(orderId);
  if (!started) return;
  const items = await orderRepository.listItems(orderId);
  const fulfillmentNotices: FulfillmentNotice[] = [];

  try {
    for (const item of items) {
      const metadata = parseJsonObject(item.metadata);
      const orderItemSourceId = `order_item:${item.id}`;
      if (item.productType === 'membership') {
        const planKey = String(item.resourceId || metadata.planKey || '');
        const durationDays = Number(metadata.durationDays || 31);
        if (planKey) {
          const existingMembership = await membershipRepository.findMembershipBySource(userId, 'order', orderItemSourceId);
          const membership = existingMembership || await membershipRepository.grantMembership({
            userId,
            planKey,
            source: 'order',
            sourceId: orderItemSourceId,
            durationDays,
            metadata: { orderId, orderItemId: item.id },
          });
          if (membership?.plan && membership.membership.source === 'order' && membership.membership.sourceId === orderItemSourceId) {
            const monthlyCredits = await grantMembershipMonthlyAICredits({
              userId,
              planId: membership.plan.id,
              planKey: membership.plan.key,
              source: 'order',
              sourceId: orderItemSourceId,
              membershipId: membership.membership.id,
              currentPeriodStart: membership.membership.currentPeriodStart,
            });
            if (monthlyCredits.granted) {
              fulfillmentNotices.push({
                type: 'membership_granted',
                title: '会员权益已开通',
                description: `${membership.plan.name} 会员已开通，AI 月额度 ${monthlyCredits.amount} 已到账。`,
                metadata: {
                  orderId,
                  orderItemId: item.id,
                  sourceId: orderItemSourceId,
                  planKey: membership.plan.key,
                  monthlyCredits,
                },
              });
            }
          }
        }
        continue;
      }

      if (item.productType === 'ai_credit_pack') {
        const credits = Number(metadata.aiCredits || 0) * Number(item.quantity || 1);
        const alreadyGranted = await walletRepository.hasTransaction(userId, 'order', orderItemSourceId);
        if (credits > 0 && !alreadyGranted) {
          await walletRepository.credit({
            userId,
            currency: WALLET_CURRENCY_AI_CREDIT,
            amount: credits,
            source: 'order',
            sourceId: orderItemSourceId,
            description: item.name,
            metadata: { orderId, orderItemId: item.id },
          });
          fulfillmentNotices.push({
            type: 'ai_credit_pack_granted',
            title: 'AI 点数已到账',
            description: `${credits} AI 点数已到账。`,
            metadata: { orderId, orderItemId: item.id, sourceId: orderItemSourceId, credits },
          });
        }
        continue;
      }

      if (item.resourceType && item.resourceId) {
        const entitlementKey = `${item.resourceType}.download`;
        const alreadyEntitledByOrder = await entitlementRepository.findBySource(userId, 'order', orderItemSourceId, entitlementKey);
        const alreadyEntitled = alreadyEntitledByOrder || await entitlementRepository.hasResource(userId, item.resourceType, item.resourceId);
        if (!alreadyEntitled) {
          const entitlement = await entitlementRepository.grant({
            userId,
            key: entitlementKey,
            value: true,
            resourceType: item.resourceType,
            resourceId: item.resourceId,
            source: 'order',
            sourceId: orderItemSourceId,
          });
          fulfillmentNotices.push({
            type: 'content_entitlement_granted',
            title: '内容权益已解锁',
            description: `${item.name} 已解锁。`,
            metadata: {
              orderId,
              orderItemId: item.id,
              sourceId: orderItemSourceId,
              entitlementId: entitlement?.id,
              resourceType: item.resourceType,
              resourceId: item.resourceId,
            },
          });
        }
        continue;
      }

      if (item.productType === 'interview_mock_pack') {
        const count = Number(metadata.count || 0) * Number(item.quantity || 1);
        const entitlementKey = String(metadata.entitlementKey || 'interview.mock.extra_count');
        const alreadyGranted = await entitlementRepository.findBySource(userId, 'order', orderItemSourceId, entitlementKey);
        if (count > 0 && !alreadyGranted) {
          const entitlement = await entitlementRepository.grant({
            userId,
            key: entitlementKey,
            value: count,
            source: 'order',
            sourceId: orderItemSourceId,
          });
          fulfillmentNotices.push({
            type: 'interview_mock_pack_granted',
            title: '模拟面试次数已到账',
            description: `${count} 次模拟面试已到账。`,
            metadata: { orderId, orderItemId: item.id, sourceId: orderItemSourceId, entitlementId: entitlement?.id, count },
          });
        }
      }
    }

    await orderRepository.markFulfilled(orderId);
    await Promise.all(fulfillmentNotices.map(async (notice) => {
      const sourceId = typeof notice.metadata?.sourceId === 'string' ? notice.metadata.sourceId : '';
      if (sourceId && await notificationStoreRepository.hasSource(userId, notice.type, sourceId)) return;
      await notificationStoreRepository.create({
        userId,
        type: notice.type,
        title: notice.title,
        description: notice.description,
        actionUrl: '/zh/account',
        metadata: notice.metadata || {},
      });
    }));
    await grantReferralOrderCommission({
      orderId,
      buyerUserId: userId,
      payableCents: Number(order.payableCents || 0),
      orderNo: order.orderNo,
    });
    const paidNoticeExists = await notificationStoreRepository.hasSource(userId, 'order_paid', orderId);
    if (!paidNoticeExists) {
      await notificationStoreRepository.create({
        userId,
        type: 'order_paid',
        title: '订单已完成',
        description: `订单 ${order.orderNo} 已完成履约。`,
        actionUrl: '/zh/account',
        metadata: { orderId, sourceId: orderId },
      });
    }
  } catch (error) {
    await orderRepository.markFulfillmentFailed(orderId, {
      fulfillmentError: error instanceof Error ? error.message : String(error),
      fulfillmentFailedAt: new Date().toISOString(),
    });
    throw error;
  }
}

export async function ensureTemplateProduct(input: {
  templateId: string;
  name: string;
  description?: string;
  priceCents?: number;
}) {
  await ensureCommercialCatalog();
  const sku = `resume-template-${input.templateId}`;
  const existing = await productRepository.findBySku(sku);
  return productRepository.upsert({
    sku,
    type: 'resume_template',
    name: input.name,
    description: input.description || '简历模板下载授权',
    priceCents: input.priceCents ?? Number(existing?.priceCents ?? 990),
    resourceType: 'resume_template',
    resourceId: input.templateId,
    metadata: { ...parseJsonObject(existing?.metadata), dynamic: true },
  });
}

export async function ensureJobTemplateProduct(input: {
  jobTemplateId: string;
  name: string;
  description?: string;
  priceCents?: number;
}) {
  await ensureCommercialCatalog();
  const sku = `job-template-${input.jobTemplateId}`;
  const existing = await productRepository.findBySku(sku);
  return productRepository.upsert({
    sku,
    type: 'job_template',
    name: input.name,
    description: input.description || '职位模板下载授权',
    priceCents: input.priceCents ?? Number(existing?.priceCents ?? 690),
    resourceType: 'job_template',
    resourceId: input.jobTemplateId,
    metadata: { ...parseJsonObject(existing?.metadata), dynamic: true },
  });
}

export async function ensureQuestionBankProduct(input: {
  bankId: string;
  bankKey: string;
  title: string;
  description?: string;
  accessLevel?: string;
  questionCount?: number;
  priceCents?: number;
}) {
  await ensureCommercialCatalog();
  const sku = `question-bank-${input.bankKey}`;
  const existing = await productRepository.findBySku(sku);
  const existingMetadata = parseJsonObject(existing?.metadata);
  return productRepository.upsert({
    sku,
    type: 'interview_question_bank',
    name: input.title,
    description: input.description || '面试题库访问授权',
    priceCents: input.priceCents ?? Number(existing?.priceCents ?? (input.accessLevel === 'premium' ? 2990 : 990)),
    resourceType: 'interview_question_bank',
    resourceId: input.bankId,
    metadata: {
      ...existingMetadata,
      dynamic: true,
      accessLevel: input.accessLevel || existingMetadata.accessLevel || 'pro',
      questionCount: input.questionCount ?? existingMetadata.questionCount ?? 0,
    },
  });
}

export function defaultProductSkus() {
  return PRODUCT_SEEDS.map((item) => item.sku);
}
