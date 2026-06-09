import { and, desc, eq, ne } from 'drizzle-orm';
import { db } from '../index';
import { resumeEvents, resumes, users } from '../schema';
import { notificationStoreRepository, walletRepository } from './commercial.repository';
import { WALLET_CURRENCY_AI_CREDIT } from '@/lib/commercial/catalog';

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  status?: string;
  createdAt: Date | number | string;
  readAt?: Date | number | string | null;
  resumeId?: string | null;
  metadata?: unknown;
};

export const notificationRepository = {
  async ensureLowCreditNotification(userId: string, credits: number) {
    if (credits > 3) return null;
    const level = credits <= 0 ? 'empty' : 'low';
    const sourceId = `low_ai_credits:${level}`;
    if (await notificationStoreRepository.hasSource(userId, 'notification_low_credits', sourceId)) {
      return null;
    }
    await notificationStoreRepository.create({
      userId,
      type: 'notification_low_credits',
      title: credits <= 0 ? 'AI 额度已用完' : 'AI 额度偏低',
      description: credits <= 0
        ? '系统 AI 额度已用完，请联系管理员补充额度或升级套餐。'
        : `当前剩余 AI 额度：${credits}，建议及时补充额度或升级套餐。`,
      actionUrl: '/zh/account',
      metadata: { sourceId, aiCredits: credits, level },
    });
    return sourceId;
  },

  async listForUser(userId: string, limit = 20): Promise<NotificationItem[]> {
    const account = await walletRepository.findAccount(userId, WALLET_CURRENCY_AI_CREDIT).catch(() => null);
    const legacyUser = await db
      .select({ aiCredits: users.aiCredits })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const credits = Number(account?.balance ?? legacyUser[0]?.aiCredits ?? 0);
    await this.ensureLowCreditNotification(userId, credits);

    const commercialNotifications = await notificationStoreRepository.listForUser(userId, limit);
    const rows = await db
      .select({
        id: resumeEvents.id,
        type: resumeEvents.type,
        title: resumeEvents.title,
        description: resumeEvents.description,
        createdAt: resumeEvents.createdAt,
        resumeId: resumeEvents.resumeId,
        metadata: resumeEvents.metadata,
      })
      .from(resumeEvents)
      .innerJoin(resumes, eq(resumeEvents.resumeId, resumes.id))
      .where(and(eq(resumes.userId, userId), ne(resumeEvents.type, 'notification_low_credits')))
      .orderBy(desc(resumeEvents.createdAt))
      .limit(limit);

    return [...commercialNotifications, ...rows];
  },

  async markRead(userId: string, ids?: string[]) {
    await notificationStoreRepository.markRead(userId, ids);
  },
};
