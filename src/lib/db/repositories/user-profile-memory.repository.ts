import { and, desc, eq } from 'drizzle-orm';
import { db } from '../index';
import { userProfileMemories } from '../schema';

export type UserProfileMemoryType =
  | 'profile'
  | 'preference'
  | 'project_fact'
  | 'skill_evidence'
  | 'interview_gap';

export const userProfileMemoryRepository = {
  async listByUserId(userId: string, limit = 30) {
    return db
      .select()
      .from(userProfileMemories)
      .where(eq(userProfileMemories.userId, userId))
      .orderBy(desc(userProfileMemories.updatedAt))
      .limit(limit);
  },

  async listByUserIdAndType(userId: string, type: string, limit = 30) {
    return db
      .select()
      .from(userProfileMemories)
      .where(and(eq(userProfileMemories.userId, userId), eq(userProfileMemories.type, type)))
      .orderBy(desc(userProfileMemories.updatedAt))
      .limit(limit);
  },

  async create(data: {
    userId: string;
    type?: UserProfileMemoryType | string;
    title: string;
    content?: string;
    source?: string;
    confidence?: number;
    metadata?: unknown;
  }) {
    const id = crypto.randomUUID();
    await db.insert(userProfileMemories).values({
      id,
      userId: data.userId,
      type: data.type || 'profile',
      title: data.title,
      content: data.content || '',
      source: data.source || 'manual',
      confidence: data.confidence ?? 80,
      metadata: data.metadata || {},
    });
    const rows = await db.select().from(userProfileMemories).where(eq(userProfileMemories.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async update(id: string, userId: string, data: Partial<{
    type: string;
    title: string;
    content: string;
    source: string;
    confidence: number;
    metadata: unknown;
  }>) {
    await db
      .update(userProfileMemories)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(userProfileMemories.id, id), eq(userProfileMemories.userId, userId)));
    const rows = await db.select().from(userProfileMemories).where(eq(userProfileMemories.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async delete(id: string, userId: string) {
    await db
      .delete(userProfileMemories)
      .where(and(eq(userProfileMemories.id, id), eq(userProfileMemories.userId, userId)));
  },
};
