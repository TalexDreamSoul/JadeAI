import { and, desc, eq, ne } from 'drizzle-orm';
import { db } from '../index';
import { resumeEvents, resumes, users } from '../schema';

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  createdAt: Date | number | string;
  resumeId?: string | null;
  metadata?: unknown;
};

export const notificationRepository = {
  async listForUser(userId: string, limit = 20): Promise<NotificationItem[]> {
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

    const user = await db
      .select({ aiCredits: users.aiCredits })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const credits = Number(user[0]?.aiCredits ?? 0);
    const creditNotice = credits <= 3
      ? [{
          id: `low-credits-${credits}`,
          type: 'notification_low_credits',
          title: credits <= 0 ? 'AI 额度已用完' : 'AI 额度偏低',
          description: credits <= 0
            ? '系统 AI 额度已用完，可以联系管理员补充或切换为自定义 API Key。'
            : `当前剩余 AI 额度：${credits}，建议及时补充或切换为自定义 API Key。`,
          createdAt: new Date(),
          resumeId: null,
          metadata: { aiCredits: credits },
        }]
      : [];

    return [...creditNotice, ...rows];
  },
};
