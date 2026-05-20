import { eq, desc, inArray } from 'drizzle-orm';
import { db } from '../index';
import { jdAnalyses, grammarChecks } from '../schema';

export const analysisRepository = {
  // ── JD Analysis ──────────────────────────────────────────

  async createJdAnalysis(data: {
    resumeId: string;
    jobDescription: string;
    result: unknown;
    overallScore: number;
    atsScore: number;
  }) {
    const id = crypto.randomUUID();
    await db.insert(jdAnalyses).values({
      id,
      resumeId: data.resumeId,
      jobDescription: data.jobDescription,
      result: data.result,
      overallScore: data.overallScore,
      atsScore: data.atsScore,
      status: 'success',
      error: null,
    } as any);
    const rows = await db.select().from(jdAnalyses).where(eq(jdAnalyses.id, id)).limit(1);
    return rows[0];
  },

  async createJdAnalysisAttempt(data: {
    resumeId: string;
    jobDescription: string;
  }) {
    const id = crypto.randomUUID();
    await db.insert(jdAnalyses).values({
      id,
      resumeId: data.resumeId,
      jobDescription: data.jobDescription,
      result: {},
      overallScore: 0,
      atsScore: 0,
      status: 'pending',
      error: null,
    } as any);
    const rows = await db.select().from(jdAnalyses).where(eq(jdAnalyses.id, id)).limit(1);
    return rows[0];
  },

  async markJdAnalysisSuccess(id: string, data: {
    result: unknown;
    overallScore: number;
    atsScore: number;
  }) {
    await db.update(jdAnalyses).set({
      result: data.result,
      overallScore: data.overallScore,
      atsScore: data.atsScore,
      status: 'success',
      error: null,
    } as any).where(eq(jdAnalyses.id, id));
    const rows = await db.select().from(jdAnalyses).where(eq(jdAnalyses.id, id)).limit(1);
    return rows[0];
  },

  async markJdAnalysisFailed(id: string, error: string) {
    await db.update(jdAnalyses).set({
      status: 'failed',
      error,
    } as any).where(eq(jdAnalyses.id, id));
    const rows = await db.select().from(jdAnalyses).where(eq(jdAnalyses.id, id)).limit(1);
    return rows[0];
  },

  async findJdAnalysesByResumeId(resumeId: string, limit = 20) {
    return db
      .select()
      .from(jdAnalyses)
      .where(eq(jdAnalyses.resumeId, resumeId))
      .orderBy(desc(jdAnalyses.createdAt))
      .limit(limit);
  },

  async findJdAnalysesByResumeIds(resumeIds: string[], limit = 50) {
    if (resumeIds.length === 0) return [];
    return db
      .select()
      .from(jdAnalyses)
      .where(inArray(jdAnalyses.resumeId, resumeIds))
      .orderBy(desc(jdAnalyses.createdAt))
      .limit(limit);
  },

  async findJdAnalysisById(id: string) {
    const rows = await db.select().from(jdAnalyses).where(eq(jdAnalyses.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async deleteJdAnalysis(id: string) {
    await db.delete(jdAnalyses).where(eq(jdAnalyses.id, id));
  },

  // ── Grammar Check ────────────────────────────────────────

  async createGrammarCheck(data: {
    resumeId: string;
    result: unknown;
    score: number;
    issueCount: number;
  }) {
    const id = crypto.randomUUID();
    await db.insert(grammarChecks).values({
      id,
      resumeId: data.resumeId,
      result: data.result,
      score: data.score,
      issueCount: data.issueCount,
      status: 'success',
      error: null,
    } as any);
    const rows = await db.select().from(grammarChecks).where(eq(grammarChecks.id, id)).limit(1);
    return rows[0];
  },

  async createGrammarCheckAttempt(data: { resumeId: string }) {
    const id = crypto.randomUUID();
    await db.insert(grammarChecks).values({
      id,
      resumeId: data.resumeId,
      result: {},
      score: 0,
      issueCount: 0,
      status: 'pending',
      error: null,
    } as any);
    const rows = await db.select().from(grammarChecks).where(eq(grammarChecks.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async markGrammarCheckSuccess(id: string, data: { result: unknown; score: number; issueCount: number }) {
    await db.update(grammarChecks).set({
      result: data.result,
      score: data.score,
      issueCount: data.issueCount,
      status: 'success',
      error: null,
    } as any).where(eq(grammarChecks.id, id));
    const rows = await db.select().from(grammarChecks).where(eq(grammarChecks.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async markGrammarCheckFailed(id: string, error: string) {
    await db.update(grammarChecks).set({ status: 'failed', error } as any).where(eq(grammarChecks.id, id));
    const rows = await db.select().from(grammarChecks).where(eq(grammarChecks.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async findGrammarChecksByResumeId(resumeId: string, limit = 20) {
    return db
      .select()
      .from(grammarChecks)
      .where(eq(grammarChecks.resumeId, resumeId))
      .orderBy(desc(grammarChecks.createdAt))
      .limit(limit);
  },

  async findGrammarCheckById(id: string) {
    const rows = await db.select().from(grammarChecks).where(eq(grammarChecks.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async deleteGrammarCheck(id: string) {
    await db.delete(grammarChecks).where(eq(grammarChecks.id, id));
  },
};
