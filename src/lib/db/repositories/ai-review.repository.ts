import { desc, eq } from 'drizzle-orm';
import { db } from '../index';
import { resumeAiReviews } from '../schema';

export const aiReviewRepository = {
  async create(data: {
    resumeId: string;
    userId: string;
    result: unknown;
    score: number;
  }) {
    const id = crypto.randomUUID();
    await db.insert(resumeAiReviews).values({
      id,
      resumeId: data.resumeId,
      userId: data.userId,
      result: data.result,
      score: data.score,
      status: 'success',
      error: null,
    } as any);
    const rows = await db.select().from(resumeAiReviews).where(eq(resumeAiReviews.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async createAttempt(data: { resumeId: string; userId: string }) {
    const id = crypto.randomUUID();
    await db.insert(resumeAiReviews).values({
      id,
      resumeId: data.resumeId,
      userId: data.userId,
      result: {},
      score: 0,
      status: 'pending',
      error: null,
    } as any);
    const rows = await db.select().from(resumeAiReviews).where(eq(resumeAiReviews.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async markSuccess(id: string, data: { result: unknown; score: number }) {
    await db.update(resumeAiReviews).set({
      result: data.result,
      score: data.score,
      status: 'success',
      error: null,
    } as any).where(eq(resumeAiReviews.id, id));
    const rows = await db.select().from(resumeAiReviews).where(eq(resumeAiReviews.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async markFailed(id: string, error: string) {
    await db.update(resumeAiReviews).set({ status: 'failed', error } as any).where(eq(resumeAiReviews.id, id));
    const rows = await db.select().from(resumeAiReviews).where(eq(resumeAiReviews.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async findByResumeId(resumeId: string, limit = 20) {
    return db
      .select()
      .from(resumeAiReviews)
      .where(eq(resumeAiReviews.resumeId, resumeId))
      .orderBy(desc(resumeAiReviews.createdAt))
      .limit(limit);
  },
};
