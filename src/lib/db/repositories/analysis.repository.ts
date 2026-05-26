import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../index';
import { jdAnalyses, grammarChecks, resumeChangeProposals } from '../schema';

export const analysisRepository = {
  // ── JD Analysis ──────────────────────────────────────────

  async createJdAnalysis(data: {
    resumeId: string;
    jobDescription: string;
    result: unknown;
    overallScore: number;
    atsScore: number;
    resumeVersionId?: string | null;
    resumeVersionLabel?: string | null;
    resumeTitleSnapshot?: string | null;
    targetCompanySnapshot?: string | null;
    targetJobTitleSnapshot?: string | null;
    jdHash?: string | null;
    analysisGroupId?: string | null;
  }) {
    const id = crypto.randomUUID();
    await db.insert(jdAnalyses).values({
      id,
      resumeId: data.resumeId,
      resumeVersionId: data.resumeVersionId ?? null,
      resumeVersionLabel: data.resumeVersionLabel ?? null,
      resumeTitleSnapshot: data.resumeTitleSnapshot ?? null,
      targetCompanySnapshot: data.targetCompanySnapshot ?? null,
      targetJobTitleSnapshot: data.targetJobTitleSnapshot ?? null,
      jdHash: data.jdHash ?? null,
      analysisGroupId: data.analysisGroupId ?? data.jdHash ?? null,
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
    resumeVersionId?: string | null;
    resumeVersionLabel?: string | null;
    resumeTitleSnapshot?: string | null;
    targetCompanySnapshot?: string | null;
    targetJobTitleSnapshot?: string | null;
    jdHash?: string | null;
    analysisGroupId?: string | null;
  }) {
    const id = crypto.randomUUID();
    await db.insert(jdAnalyses).values({
      id,
      resumeId: data.resumeId,
      resumeVersionId: data.resumeVersionId ?? null,
      resumeVersionLabel: data.resumeVersionLabel ?? null,
      resumeTitleSnapshot: data.resumeTitleSnapshot ?? null,
      targetCompanySnapshot: data.targetCompanySnapshot ?? null,
      targetJobTitleSnapshot: data.targetJobTitleSnapshot ?? null,
      jdHash: data.jdHash ?? null,
      analysisGroupId: data.analysisGroupId ?? data.jdHash ?? null,
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

  // ── Change Proposals ─────────────────────────────────────

  async createChangeProposal(data: {
    resumeId: string;
    userId?: string | null;
    source?: string;
    sourceId?: string | null;
    shareId?: string | null;
    commentId?: string | null;
    sectionId?: string | null;
    sectionType: string;
    targetField?: string;
    current?: string;
    suggested: string;
    reason?: string;
    evidenceRequired?: boolean;
    metadata?: unknown;
  }) {
    const id = crypto.randomUUID();
    await db.insert(resumeChangeProposals).values({
      id,
      resumeId: data.resumeId,
      userId: data.userId ?? null,
      source: data.source || 'ai',
      sourceId: data.sourceId ?? null,
      shareId: data.shareId ?? null,
      commentId: data.commentId ?? null,
      sectionId: data.sectionId ?? null,
      sectionType: data.sectionType,
      targetField: data.targetField || 'text',
      current: data.current || '',
      suggested: data.suggested,
      reason: data.reason || '',
      evidenceRequired: !!data.evidenceRequired,
      status: 'pending',
      metadata: data.metadata || {},
    } as any);
    const rows = await db.select().from(resumeChangeProposals).where(eq(resumeChangeProposals.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async findChangeProposalsByResumeId(resumeId: string, limit = 50) {
    return db
      .select()
      .from(resumeChangeProposals)
      .where(eq(resumeChangeProposals.resumeId, resumeId))
      .orderBy(desc(resumeChangeProposals.createdAt))
      .limit(limit);
  },

  async findChangeProposalById(id: string) {
    const rows = await db.select().from(resumeChangeProposals).where(eq(resumeChangeProposals.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async findChangeProposalByCommentId(commentId: string) {
    const rows = await db.select().from(resumeChangeProposals).where(eq(resumeChangeProposals.commentId, commentId)).limit(1);
    return rows[0] ?? null;
  },

  async updateChangeProposal(id: string, data: Partial<{
    status: string;
    beforeVersionId: string | null;
    appliedVersionId: string | null;
    undoContent: unknown;
    metadata: unknown;
  }>) {
    await db.update(resumeChangeProposals).set({ ...data, updatedAt: new Date() } as any).where(eq(resumeChangeProposals.id, id));
    const rows = await db.select().from(resumeChangeProposals).where(eq(resumeChangeProposals.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async deleteChangeProposal(id: string) {
    await db.delete(resumeChangeProposals).where(eq(resumeChangeProposals.id, id));
  },

  async deleteChangeProposalsForComment(commentId: string) {
    await db.delete(resumeChangeProposals).where(eq(resumeChangeProposals.commentId, commentId));
  },

  async findOpenChangeProposalsForSource(resumeId: string, source: string, sourceId: string) {
    return db
      .select()
      .from(resumeChangeProposals)
      .where(and(
        eq(resumeChangeProposals.resumeId, resumeId),
        eq(resumeChangeProposals.source, source),
        eq(resumeChangeProposals.sourceId, sourceId),
        eq(resumeChangeProposals.status, 'pending'),
      ));
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
