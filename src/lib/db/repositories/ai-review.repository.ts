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
    });
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
