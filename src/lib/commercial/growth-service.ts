import { WALLET_CURRENCY_AI_CREDIT, WALLET_CURRENCY_POINT } from './catalog';
import { getNumericEntitlement, getUserEntitlementProfile } from './entitlement-service';
import { parseJsonObject } from './json';
import {
  lotteryCampaigns,
  referralRelations,
} from '@/lib/db/schema';
import {
  interviewQuestionPracticeRepository,
  lotteryRepository,
  notificationStoreRepository,
  referralRepository,
  walletRepository,
} from '@/lib/db/repositories/commercial.repository';
import { userRepository } from '@/lib/db/repositories/user.repository';

const DAILY_CHECKIN_TASK_ID = 'daily-checkin';
const PRACTICE_STREAK_TASK_ID = 'practice-streak';
const DEFAULT_LOTTERY_KEY = 'daily-growth-lottery';
const BASE_INVITER_REFERRAL_REWARD = 100;
const INVITEE_REFERRAL_REWARD = 50;
const ORDER_COMMISSION_SOURCE = 'referral_order_commission';

type GrowthTask = {
  id: string;
  title: string;
  description: string;
  reward: {
    currency: string;
    amount: number;
  };
  claimable: boolean;
  claimed: boolean;
};

type LotteryCampaignRecord = typeof lotteryCampaigns.$inferSelect;
type ReferralRelationRecord = typeof referralRelations.$inferSelect;
type WalletPrize = {
  type: 'wallet';
  currency: string;
  amount: number;
  title: string;
};
type EmptyPrize = {
  type: 'none';
  title: string;
};
type LotteryPrize = WalletPrize | EmptyPrize;
type GrowthLevel = {
  key: string;
  name: string;
  minPoints: number;
};
type ReferralRewardPolicy = {
  currency: string;
  baseInviterReward: number;
  inviterRewardAmount: number;
  inviteeRewardAmount: number;
  commissionRate: number;
  planKey: string;
};
type ReferralOrderCommission = {
  currency: string;
  amount: number;
  commissionRate: number;
  inviterUserId: string;
  inviteeUserId: string;
};

const GROWTH_LEVELS: GrowthLevel[] = [
  { key: 'starter', name: '求职新手', minPoints: 0 },
  { key: 'builder', name: '成长求职者', minPoints: 500 },
  { key: 'hunter', name: '机会猎手', minPoints: 2000 },
  { key: 'expert', name: '面试专家', minPoints: 6000 },
  { key: 'mentor', name: '职业导师', minPoints: 15000 },
];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function referralCode(userId: string) {
  return Buffer.from(userId).toString('base64url');
}

function decodeReferralCode(code: string) {
  try {
    const decoded = Buffer.from(code.trim(), 'base64url').toString('utf8');
    return decoded || null;
  } catch {
    return null;
  }
}

function taskSourceId(taskId: string) {
  return `${taskId}:${todayKey()}`;
}

function normalizeRate(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

async function getReferralRewardPolicy(userId: string): Promise<ReferralRewardPolicy> {
  const profile = await getUserEntitlementProfile(userId);
  const commissionRate = normalizeRate(getNumericEntitlement(profile, 'promotion.commission_rate', 0));
  const inviterRewardAmount = Math.round(BASE_INVITER_REFERRAL_REWARD * (1 + commissionRate / 100));

  return {
    currency: WALLET_CURRENCY_POINT,
    baseInviterReward: BASE_INVITER_REFERRAL_REWARD,
    inviterRewardAmount,
    inviteeRewardAmount: INVITEE_REFERRAL_REWARD,
    commissionRate,
    planKey: profile.membership?.plan.key || 'free',
  };
}

async function wouldCreateReferralCycle(inviterUserId: string, inviteeUserId: string) {
  const visited = new Set<string>();
  let currentUserId: string | null = inviterUserId;
  while (currentUserId && !visited.has(currentUserId)) {
    if (currentUserId === inviteeUserId) return true;
    visited.add(currentUserId);
    const upstream = await referralRepository.listForInvitee(currentUserId, 1);
    currentUserId = upstream[0]?.inviterUserId || null;
  }
  return false;
}

function calculateOrderCommissionAmount(payableCents: number, commissionRate: number) {
  const amount = Math.round(Math.max(0, payableCents) * normalizeRate(commissionRate) / 100);
  return amount > 0 ? amount : 0;
}

async function getGrowthLevel(userId: string) {
  const totalPoints = await walletRepository.sumCredits(userId, WALLET_CURRENCY_POINT);
  const current = [...GROWTH_LEVELS]
    .reverse()
    .find((level) => totalPoints >= level.minPoints) || GROWTH_LEVELS[0];
  const currentIndex = GROWTH_LEVELS.findIndex((level) => level.key === current.key);
  const next = GROWTH_LEVELS[currentIndex + 1] || null;

  return {
    key: current.key,
    name: current.name,
    level: currentIndex + 1,
    totalPoints,
    next,
    pointsToNext: next ? Math.max(0, next.minPoints - totalPoints) : 0,
    progress: next
      ? Math.min(100, Math.floor((totalPoints - current.minPoints) * 100 / (next.minPoints - current.minPoints)))
      : 100,
  };
}

async function taskClaimed(userId: string, taskId: string) {
  return walletRepository.hasTransaction(userId, 'growth_task', taskSourceId(taskId));
}

async function hasPracticeAttemptToday(userId: string) {
  const attempts = await interviewQuestionPracticeRepository.listAttemptsForUser(userId, 20);
  return attempts.some((attempt: { createdAt: Date | number | string }) => (
    new Date(attempt.createdAt).toISOString().slice(0, 10) === todayKey()
  ));
}

async function growthTasks(userId: string): Promise<GrowthTask[]> {
  const [dailyClaimed, practiceClaimed, practicedToday] = await Promise.all([
    taskClaimed(userId, DAILY_CHECKIN_TASK_ID),
    taskClaimed(userId, PRACTICE_STREAK_TASK_ID),
    hasPracticeAttemptToday(userId),
  ]);

  return [
    {
      id: DAILY_CHECKIN_TASK_ID,
      title: '每日签到',
      description: '每天领取一次积分，后续可接入连续签到倍率。',
      reward: { currency: WALLET_CURRENCY_POINT, amount: 20 },
      claimable: !dailyClaimed,
      claimed: dailyClaimed,
    },
    {
      id: PRACTICE_STREAK_TASK_ID,
      title: '完成一次面试练习',
      description: '完成任意题库练习后可领取，推动题库练习和错题本增长。',
      reward: { currency: WALLET_CURRENCY_AI_CREDIT, amount: 5 },
      claimable: practicedToday && !practiceClaimed,
      claimed: practiceClaimed,
    },
  ];
}

async function ensureDefaultLottery() {
  return lotteryRepository.upsertCampaign({
    key: DEFAULT_LOTTERY_KEY,
    title: '每日成长抽奖',
    status: 'active',
    rules: {
      cost: { currency: WALLET_CURRENCY_POINT, amount: 10 },
      prizes: [
        { type: 'wallet', currency: WALLET_CURRENCY_AI_CREDIT, amount: 5, title: 'AI 点数 5' },
        { type: 'wallet', currency: WALLET_CURRENCY_POINT, amount: 30, title: '积分 30' },
        { type: 'none', title: '谢谢参与' },
      ],
    },
  });
}

function choosePrize(seed: string): LotteryPrize {
  const bucket = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 100;
  if (bucket < 45) return { type: 'wallet', currency: WALLET_CURRENCY_AI_CREDIT, amount: 5, title: 'AI 点数 5' };
  if (bucket < 85) return { type: 'wallet', currency: WALLET_CURRENCY_POINT, amount: 30, title: '积分 30' };
  return { type: 'none', title: '谢谢参与' };
}

export async function getGrowthDashboard(userId: string) {
  const [tasks, referrals, invitedBy, campaigns, draws, rewardPolicy, level] = await Promise.all([
    growthTasks(userId),
    referralRepository.listForInviter(userId, 20),
    referralRepository.listForInvitee(userId, 5),
    lotteryRepository.listCampaigns(true),
    lotteryRepository.listDrawsForUser(userId, 20),
    getReferralRewardPolicy(userId),
    getGrowthLevel(userId),
  ]);
  const campaignRows = campaigns as LotteryCampaignRecord[];
  const referralRows = referrals as ReferralRelationRecord[];
  const defaultCampaign = campaignRows.find((campaign) => campaign.key === DEFAULT_LOTTERY_KEY) || await ensureDefaultLottery();

  return {
    referral: {
      code: referralCode(userId),
      inviteCount: referralRows.length,
      rewardCount: referralRows.filter((item) => item.rewardStatus === 'granted').length,
      rewardPolicy,
      invitedBy: invitedBy[0] || null,
      relations: referralRows,
    },
    level,
    tasks,
    lottery: {
      campaign: defaultCampaign,
      draws,
    },
  };
}

export async function claimGrowthTask(userId: string, taskId: string) {
  const tasks = await growthTasks(userId);
  const task = tasks.find((item) => item.id === taskId);
  if (!task) throw new Error('任务不存在');
  if (task.claimed) throw new Error('今天已经领取过该任务奖励');
  if (!task.claimable) throw new Error('任务暂不可领取');

  const sourceId = taskSourceId(task.id);
  if (await walletRepository.hasTransaction(userId, 'growth_task', sourceId)) {
    throw new Error('今天已经领取过该任务奖励');
  }
  await walletRepository.credit({
    userId,
    currency: task.reward.currency,
    amount: task.reward.amount,
    source: 'growth_task',
    sourceId,
    description: `${task.title}奖励`,
    metadata: { taskId: task.id, date: todayKey() },
  });
  if (!(await notificationStoreRepository.hasSource(userId, 'growth_task', sourceId))) {
    await notificationStoreRepository.create({
      userId,
      type: 'growth_task',
      title: '任务奖励已到账',
      description: `${task.title}奖励 ${task.reward.amount} ${task.reward.currency === WALLET_CURRENCY_POINT ? '积分' : 'AI 点数'}。`,
      actionUrl: '/zh/account',
      metadata: { taskId: task.id, sourceId },
    });
  }

  return { taskId: task.id, reward: task.reward };
}

export async function bindReferral(input: {
  inviteeUserId: string;
  code: string;
}) {
  const inviterUserId = decodeReferralCode(input.code);
  if (!inviterUserId) throw new Error('邀请码无效');
  if (inviterUserId === input.inviteeUserId) throw new Error('不能绑定自己的邀请码');

  const inviter = await userRepository.findById(inviterUserId);
  if (!inviter) throw new Error('邀请人不存在');
  const existingInviteeRelations = await referralRepository.listForInvitee(input.inviteeUserId, 1);
  if (existingInviteeRelations.length) throw new Error('你已经绑定过邀请关系');
  if (await wouldCreateReferralCycle(inviterUserId, input.inviteeUserId)) {
    throw new Error('不能绑定下级用户的邀请码');
  }

  const rewardPolicy = await getReferralRewardPolicy(inviterUserId);
  const relation = await referralRepository.createRelation({
    inviterUserId,
    inviteeUserId: input.inviteeUserId,
    campaignKey: 'default',
    status: 'activated',
    rewardStatus: 'granted',
    metadata: { code: input.code, rewardPolicy },
  });
  if (!relation) throw new Error('邀请关系创建失败');
  if (relation.inviterUserId !== inviterUserId || relation.inviteeUserId !== input.inviteeUserId) {
    throw new Error('你已经绑定过邀请关系');
  }

  const inviterAlreadyRewarded = await walletRepository.hasTransaction(inviterUserId, 'referral_reward', relation.id);
  const inviteeAlreadyRewarded = await walletRepository.hasTransaction(input.inviteeUserId, 'referral_bind', relation.id);
  if (inviterAlreadyRewarded || inviteeAlreadyRewarded) {
    throw new Error('你已经绑定过邀请关系');
  }

  await Promise.all([
    walletRepository.credit({
      userId: inviterUserId,
      currency: rewardPolicy.currency,
      amount: rewardPolicy.inviterRewardAmount,
      source: 'referral_reward',
      sourceId: relation.id,
      description: '邀请好友奖励',
      metadata: { inviteeUserId: input.inviteeUserId, rewardPolicy },
    }),
    walletRepository.credit({
      userId: input.inviteeUserId,
      currency: rewardPolicy.currency,
      amount: rewardPolicy.inviteeRewardAmount,
      source: 'referral_bind',
      sourceId: relation.id,
      description: '绑定邀请码奖励',
      metadata: { inviterUserId, rewardPolicy },
    }),
  ]);
  await Promise.all([
    createNotificationOnce({
      userId: inviterUserId,
      type: 'referral_reward',
      sourceId: relation.id,
      title: '邀请奖励已到账',
      description: `好友完成绑定，${rewardPolicy.inviterRewardAmount} 积分已到账。`,
      metadata: { relationId: relation.id, rewardPolicy },
    }),
    createNotificationOnce({
      userId: input.inviteeUserId,
      type: 'referral_bind',
      sourceId: relation.id,
      title: '邀请码绑定成功',
      description: `新人奖励 ${rewardPolicy.inviteeRewardAmount} 积分已到账。`,
      metadata: { relationId: relation.id, rewardPolicy },
    }),
  ]);

  return {
    relation,
    reward: {
      inviter: { currency: rewardPolicy.currency, amount: rewardPolicy.inviterRewardAmount },
      invitee: { currency: rewardPolicy.currency, amount: rewardPolicy.inviteeRewardAmount },
      policy: rewardPolicy,
    },
  };
}

export async function grantReferralOrderCommission(input: {
  orderId: string;
  buyerUserId: string;
  payableCents: number;
  orderNo?: string;
}) {
  if (input.payableCents <= 0) return null;

  const invitedBy = await referralRepository.listForInvitee(input.buyerUserId, 1);
  const relation = invitedBy[0];
  if (!relation || relation.status !== 'activated') return null;

  const rewardPolicy = await getReferralRewardPolicy(relation.inviterUserId);
  const amount = calculateOrderCommissionAmount(input.payableCents, rewardPolicy.commissionRate);
  if (amount <= 0) return null;

  const alreadyGranted = await walletRepository.hasTransaction(
    relation.inviterUserId,
    ORDER_COMMISSION_SOURCE,
    input.orderId,
  );
  if (alreadyGranted) return null;

  const commission: ReferralOrderCommission = {
    currency: WALLET_CURRENCY_POINT,
    amount,
    commissionRate: rewardPolicy.commissionRate,
    inviterUserId: relation.inviterUserId,
    inviteeUserId: input.buyerUserId,
  };

  await walletRepository.credit({
    userId: relation.inviterUserId,
    currency: commission.currency,
    amount: commission.amount,
    source: ORDER_COMMISSION_SOURCE,
    sourceId: input.orderId,
    description: '推广订单返利',
    metadata: {
      relationId: relation.id,
      buyerUserId: input.buyerUserId,
      orderNo: input.orderNo || '',
      payableCents: input.payableCents,
      commission,
    },
  });
  await createNotificationOnce({
    userId: relation.inviterUserId,
    type: ORDER_COMMISSION_SOURCE,
    sourceId: input.orderId,
    title: '推广返利已到账',
    description: `好友订单完成，${commission.amount} 积分返利已到账。`,
    metadata: {
      relationId: relation.id,
      orderId: input.orderId,
      buyerUserId: input.buyerUserId,
      commission,
    },
  });

  return commission;
}

export async function drawGrowthLottery(userId: string) {
  const campaign = await ensureDefaultLottery();
  if (!campaign || campaign.status !== 'active') throw new Error('抽奖活动不可用');

  const rules = parseJsonObject(campaign.rules);
  const cost = parseJsonObject(rules.cost);
  const costCurrency = String(cost.currency || WALLET_CURRENCY_POINT);
  const costAmount = Math.max(1, Math.floor(Number(cost.amount || 10)));
  const drawId = crypto.randomUUID();
  const debit = await walletRepository.debit({
    userId,
    currency: costCurrency,
    amount: costAmount,
    source: 'lottery_draw_cost',
    sourceId: drawId,
    description: '每日成长抽奖',
    metadata: { campaignId: campaign.id, costCurrency, costAmount },
  });
  if (!debit.ok) throw new Error('积分不足，无法抽奖');

  const draw = await lotteryRepository.createDraw({
    id: drawId,
    campaignId: campaign.id,
    userId,
    prizeType: 'pending',
    prizePayload: { costCurrency, costAmount },
    status: 'pending',
  });
  if (!draw) {
    await walletRepository.credit({
      userId,
      currency: costCurrency,
      amount: costAmount,
      source: 'lottery_draw_refund',
      sourceId: drawId,
      description: '抽奖失败退款',
      metadata: { campaignId: campaign.id, drawId, costCurrency, costAmount },
    });
    throw new Error('抽奖记录创建失败');
  }

  try {
    const prize = choosePrize(`${userId}:${drawId}`);
    if (prize.type === 'wallet') {
      await walletRepository.credit({
        userId,
        currency: prize.currency,
        amount: prize.amount,
        source: 'lottery_prize',
        sourceId: draw.id,
        description: `抽奖获得${prize.title}`,
        metadata: { campaignId: campaign.id, drawId: draw.id, prize },
      });
    }
    const completedDraw = await lotteryRepository.updateDraw(draw.id, {
      prizeType: prize.type,
      prizePayload: prize,
      status: 'completed',
    });
    if (!completedDraw) throw new Error('抽奖记录更新失败');
    await createNotificationOnce({
      userId,
      type: 'lottery_draw',
      sourceId: completedDraw.id,
      title: prize.type === 'none' ? '抽奖完成' : '抽中奖励',
      description: prize.title,
      metadata: { campaignId: campaign.id, drawId: completedDraw.id, prize },
    });

    return { draw: completedDraw, prize };
  } catch (error) {
    await lotteryRepository.updateDraw(draw.id, {
      status: 'failed',
      prizePayload: {
        costCurrency,
        costAmount,
        error: error instanceof Error ? error.message : String(error),
      },
    }).catch(() => null);
    await walletRepository.credit({
      userId,
      currency: costCurrency,
      amount: costAmount,
      source: 'lottery_draw_refund',
      sourceId: draw.id,
      description: '抽奖失败退款',
      metadata: { campaignId: campaign.id, drawId: draw.id, costCurrency, costAmount },
    });
    throw error;
  }
}

async function createNotificationOnce(input: {
  userId: string;
  type: string;
  sourceId: string;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
}) {
  if (await notificationStoreRepository.hasSource(input.userId, input.type, input.sourceId)) return null;
  return notificationStoreRepository.create({
    userId: input.userId,
    type: input.type,
    title: input.title,
    description: input.description,
    actionUrl: '/zh/account',
    metadata: {
      ...(input.metadata || {}),
      sourceId: input.sourceId,
    },
  });
}
