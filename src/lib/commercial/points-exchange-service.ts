import { getNumericEntitlement, getUserEntitlementProfile } from './entitlement-service';
import { WALLET_CURRENCY_AI_CREDIT, WALLET_CURRENCY_POINT } from './catalog';
import {
  entitlementRepository,
  notificationStoreRepository,
  walletRepository,
} from '@/lib/db/repositories/commercial.repository';

type PointsExchangeReward =
  | {
      type: 'wallet';
      currency: string;
      amount: number;
    }
  | {
      type: 'entitlement';
      key: string;
      value: number;
      expiresInDays?: number;
    };

type PointsExchangeItem = {
  id: string;
  title: string;
  description: string;
  baseCost: number;
  reward: PointsExchangeReward;
};

const POINTS_EXCHANGE_ITEMS: PointsExchangeItem[] = [
  {
    id: 'ai-credit-50',
    title: 'AI 点数 50',
    description: '用于简历优化、JD 分析、面试题评分等 AI 功能。',
    baseCost: 500,
    reward: { type: 'wallet', currency: WALLET_CURRENCY_AI_CREDIT, amount: 50 },
  },
  {
    id: 'interview-mock-3',
    title: '模拟面试 3 次',
    description: '兑换后 30 天内计入额外模拟面试次数。',
    baseCost: 800,
    reward: { type: 'entitlement', key: 'interview.mock.extra_count', value: 3, expiresInDays: 30 },
  },
];

function clampDiscount(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(90, Math.max(0, value));
}

function rewardLabel(reward: PointsExchangeReward) {
  if (reward.type === 'wallet' && reward.currency === WALLET_CURRENCY_AI_CREDIT) {
    return `${reward.amount} AI 点数`;
  }
  if (reward.type === 'wallet' && reward.currency === WALLET_CURRENCY_POINT) {
    return `${reward.amount} 积分`;
  }
  if (reward.type === 'entitlement' && reward.key === 'interview.mock.extra_count') {
    return `${reward.value} 次模拟面试`;
  }
  return '福利';
}

function expiresAtFromDays(days?: number) {
  if (!days || days <= 0) return null;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

async function exchangeContext(userId: string) {
  const profile = await getUserEntitlementProfile(userId);
  const discountRate = clampDiscount(getNumericEntitlement(profile, 'points.exchange.discount_rate', 0));
  return {
    discountRate,
    planKey: profile.membership?.plan.key || 'free',
  };
}

function applyDiscount(baseCost: number, discountRate: number) {
  return Math.max(1, Math.ceil(baseCost * (100 - discountRate) / 100));
}

export async function listPointsExchangeItems(userId: string) {
  const context = await exchangeContext(userId);
  return {
    discountRate: context.discountRate,
    planKey: context.planKey,
    items: POINTS_EXCHANGE_ITEMS.map((item) => ({
      ...item,
      cost: applyDiscount(item.baseCost, context.discountRate),
    })),
  };
}

export async function exchangePointsForBenefit(input: {
  userId: string;
  itemId: string;
  requestId?: string;
}) {
  const catalog = await listPointsExchangeItems(input.userId);
  const item = catalog.items.find((candidate) => candidate.id === input.itemId);
  if (!item) throw new Error('兑换项不存在');

  const sourceId = pointsExchangeSourceId(item.id, input.requestId);
  const refundExists = await walletRepository.hasTransaction(input.userId, 'points_exchange_refund', sourceId);
  if (refundExists) throw new Error('该兑换请求已退款，请重新发起兑换');

  const debit = await walletRepository.debit({
    userId: input.userId,
    currency: WALLET_CURRENCY_POINT,
    amount: item.cost,
    source: 'points_exchange',
    sourceId,
    description: `积分兑换${item.title}`,
    metadata: {
      itemId: item.id,
      baseCost: item.baseCost,
      cost: item.cost,
      discountRate: catalog.discountRate,
      reward: item.reward,
    },
  });
  if (!debit.ok) throw new Error('积分不足，无法兑换');

  try {
    await grantPointsExchangeReward({
      userId: input.userId,
      item,
      cost: item.cost,
      sourceId,
    });
  } catch (error) {
    await walletRepository.credit({
      userId: input.userId,
      currency: WALLET_CURRENCY_POINT,
      amount: item.cost,
      source: 'points_exchange_refund',
      sourceId,
      description: `积分兑换${item.title}失败退款`,
      metadata: {
        itemId: item.id,
        cost: item.cost,
        reward: item.reward,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }

  if (!(await notificationStoreRepository.hasSource(input.userId, 'points_exchange', sourceId))) {
    await notificationStoreRepository.create({
      userId: input.userId,
      type: 'points_exchange',
      title: '积分兑换成功',
      description: `${item.cost} 积分已兑换 ${rewardLabel(item.reward)}。`,
      actionUrl: '/zh/account',
      metadata: {
        itemId: item.id,
        sourceId,
        cost: item.cost,
        reward: item.reward,
      },
    });
  }

  return {
    item,
    cost: item.cost,
    discountRate: catalog.discountRate,
    sourceId,
    replayed: debit.applied === false,
  };
}

function pointsExchangeSourceId(itemId: string, requestId?: string) {
  const normalizedRequestId = (requestId || '').trim();
  if (!normalizedRequestId) return `${itemId}:${crypto.randomUUID()}`;
  return `${itemId}:request:${normalizedRequestId.slice(0, 120)}`;
}

async function grantPointsExchangeReward(input: {
  userId: string;
  item: PointsExchangeItem & { cost: number };
  cost: number;
  sourceId: string;
}) {
  const { userId, item, cost, sourceId } = input;

  if (item.reward.type === 'wallet') {
    await walletRepository.credit({
      userId,
      currency: item.reward.currency,
      amount: item.reward.amount,
      source: 'points_exchange_reward',
      sourceId,
      description: `积分兑换${item.title}`,
      metadata: { itemId: item.id, cost },
    });
    return;
  }

  const existing = await entitlementRepository.findAnyBySource(
    userId,
    'points_exchange',
    sourceId,
    item.reward.key,
  );
  if (existing) return;

  await entitlementRepository.grant({
    userId,
    key: item.reward.key,
    value: item.reward.value,
    source: 'points_exchange',
    sourceId,
    expiresAt: expiresAtFromDays(item.reward.expiresInDays),
  });
}
