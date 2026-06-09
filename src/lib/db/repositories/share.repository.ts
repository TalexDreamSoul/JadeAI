import { and, count, desc, eq, gt, max, sql } from 'drizzle-orm';
import { db } from '../index';
import { resumeReviewComments, resumeReviewPresence, resumes, resumeShares, users } from '../schema';

export const shareRepository = {
  async findByResumeId(resumeId: string) {
    return db
      .select()
      .from(resumeShares)
      .where(eq(resumeShares.resumeId, resumeId))
      .orderBy(desc(resumeShares.createdAt));
  },

  async findSummariesByResumeId(resumeId: string) {
    const shares = await this.findByResumeId(resumeId);
    const comments = await db
      .select({
        shareId: resumeReviewComments.shareId,
        commentCount: count(resumeReviewComments.id),
        lastCommentAt: max(resumeReviewComments.updatedAt),
      })
      .from(resumeReviewComments)
      .where(eq(resumeReviewComments.resumeId, resumeId))
      .groupBy(resumeReviewComments.shareId);
    type ShareRecord = (typeof shares)[number];
    type CommentStat = (typeof comments)[number];
    const commentStats = new Map<string, CommentStat>(comments.map((item: CommentStat) => [item.shareId, item]));
    return shares.map((share: ShareRecord) => {
      const stats = commentStats.get(share.id);
      return {
        ...share,
        commentCount: Number(stats?.commentCount || 0),
        lastCommentAt: stats?.lastCommentAt || null,
      };
    });
  },

  async findByToken(token: string) {
    const rows = await db
      .select()
      .from(resumeShares)
      .where(eq(resumeShares.token, token))
      .limit(1);
    return rows[0] ?? null;
  },

  async findById(id: string) {
    const rows = await db
      .select()
      .from(resumeShares)
      .where(eq(resumeShares.id, id))
      .limit(1);
    return rows[0] ?? null;
  },

  async create(data: {
    resumeId: string;
    token: string;
    label?: string;
    password?: string | null;
    reviewEnabled?: boolean;
    downloadEnabled?: boolean;
    viewRequiresLogin?: boolean;
    anonymousShare?: boolean;
    hideSensitiveInfo?: boolean;
  }) {
    const id = crypto.randomUUID();
    await db.insert(resumeShares).values({
      id,
      resumeId: data.resumeId,
      token: data.token,
      label: data.label || '',
      password: data.password ?? null,
      reviewEnabled: data.reviewEnabled ?? false,
      downloadEnabled: data.downloadEnabled ?? true,
      viewRequiresLogin: data.viewRequiresLogin ?? false,
      anonymousShare: data.anonymousShare ?? false,
      hideSensitiveInfo: data.hideSensitiveInfo ?? false,
    });
    const rows = await db.select().from(resumeShares).where(eq(resumeShares.id, id)).limit(1);
    return rows[0];
  },

  async update(id: string, data: {
    label?: string;
    password?: string | null;
    isActive?: boolean;
    reviewEnabled?: boolean;
    downloadEnabled?: boolean;
    viewRequiresLogin?: boolean;
    anonymousShare?: boolean;
    hideSensitiveInfo?: boolean;
  }) {
    const setClause: Record<string, unknown> = { updatedAt: new Date() };
    if (data.label !== undefined) setClause.label = data.label;
    if (data.password !== undefined) setClause.password = data.password;
    if (data.isActive !== undefined) setClause.isActive = data.isActive;
    if (data.reviewEnabled !== undefined) setClause.reviewEnabled = data.reviewEnabled;
    if (data.downloadEnabled !== undefined) setClause.downloadEnabled = data.downloadEnabled;
    if (data.viewRequiresLogin !== undefined) setClause.viewRequiresLogin = data.viewRequiresLogin;
    if (data.anonymousShare !== undefined) setClause.anonymousShare = data.anonymousShare;
    if (data.hideSensitiveInfo !== undefined) setClause.hideSensitiveInfo = data.hideSensitiveInfo;

    await db.update(resumeShares).set(setClause).where(eq(resumeShares.id, id));
    const rows = await db.select().from(resumeShares).where(eq(resumeShares.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async delete(id: string) {
    await db.delete(resumeShares).where(eq(resumeShares.id, id));
  },

  async incrementViewCount(id: string) {
    await db
      .update(resumeShares)
      .set({ viewCount: sql`${resumeShares.viewCount} + 1` })
      .where(eq(resumeShares.id, id));
  },

  async findCommentsByShareId(shareId: string) {
    return db
      .select()
      .from(resumeReviewComments)
      .where(eq(resumeReviewComments.shareId, shareId))
      .orderBy(desc(resumeReviewComments.createdAt));
  },

  async listAllCommentsDetailed(limit = 100, status?: string) {
    const baseQuery = db
      .select({
        comment: resumeReviewComments,
        share: {
          id: resumeShares.id,
          token: resumeShares.token,
          label: resumeShares.label,
          reviewEnabled: resumeShares.reviewEnabled,
          isActive: resumeShares.isActive,
        },
        resume: {
          id: resumes.id,
          title: resumes.title,
          targetCompany: resumes.targetCompany,
          targetJobTitle: resumes.targetJobTitle,
        },
        authorUser: {
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
        },
      })
      .from(resumeReviewComments)
      .leftJoin(resumeShares, eq(resumeReviewComments.shareId, resumeShares.id))
      .leftJoin(resumes, eq(resumeReviewComments.resumeId, resumes.id))
      .leftJoin(users, eq(resumeReviewComments.authorUserId, users.id));

    const rows = status
      ? await baseQuery
        .where(eq(resumeReviewComments.status, status))
        .orderBy(desc(resumeReviewComments.createdAt))
        .limit(limit)
      : await baseQuery
        .orderBy(desc(resumeReviewComments.createdAt))
        .limit(limit);

    return rows.map((row: {
      comment: typeof resumeReviewComments.$inferSelect;
      share: {
        id: string | null;
        token: string | null;
        label: string | null;
        reviewEnabled: boolean | number | null;
        isActive: boolean | number | null;
      } | null;
      resume: {
        id: string | null;
        title: string | null;
        targetCompany: string | null;
        targetJobTitle: string | null;
      } | null;
      authorUser: {
        id: string | null;
        email: string | null;
        name: string | null;
        role: string | null;
      } | null;
    }) => ({
      ...row.comment,
      share: row.share?.id ? row.share : null,
      resume: row.resume?.id ? row.resume : null,
      authorUser: row.authorUser?.id ? row.authorUser : null,
    }));
  },

  async createComment(data: {
    shareId: string;
    resumeId: string;
    parentCommentId?: string | null;
    authorUserId?: string | null;
    authorName?: string;
    authorEmail?: string | null;
    sectionId?: string | null;
    selectedText?: string | null;
    anchor?: unknown;
    content: string;
  }) {
    const id = crypto.randomUUID();
    await db.insert(resumeReviewComments).values({
      id,
      shareId: data.shareId,
      resumeId: data.resumeId,
      parentCommentId: data.parentCommentId || null,
      authorUserId: data.authorUserId || null,
      authorName: data.authorName?.trim() || 'Reviewer',
      authorEmail: data.authorEmail || null,
      sectionId: data.sectionId || null,
      selectedText: data.selectedText || null,
      anchor: data.anchor || null,
      content: data.content,
    });
    const rows = await db.select().from(resumeReviewComments).where(eq(resumeReviewComments.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async updateCommentStatus(id: string, status: string) {
    await db
      .update(resumeReviewComments)
      .set({ status, updatedAt: new Date() })
      .where(eq(resumeReviewComments.id, id));
    const rows = await db.select().from(resumeReviewComments).where(eq(resumeReviewComments.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async upsertPresence(data: {
    shareId: string;
    resumeId: string;
    userId: string;
    reviewerName: string;
    reviewerEmail?: string | null;
    reviewerAvatarUrl?: string | null;
    cursorX: number;
    cursorY: number;
    color: string;
  }) {
    const existing = await db
      .select()
      .from(resumeReviewPresence)
      .where(and(eq(resumeReviewPresence.shareId, data.shareId), eq(resumeReviewPresence.userId, data.userId)))
      .limit(1);

    if (existing[0]) {
      await db
        .update(resumeReviewPresence)
        .set({
          reviewerName: data.reviewerName,
          reviewerEmail: data.reviewerEmail || null,
          reviewerAvatarUrl: data.reviewerAvatarUrl || null,
          cursorX: Math.round(data.cursorX),
          cursorY: Math.round(data.cursorY),
          color: data.color,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(resumeReviewPresence.id, existing[0].id));
      const rows = await db.select().from(resumeReviewPresence).where(eq(resumeReviewPresence.id, existing[0].id)).limit(1);
      return rows[0] ?? null;
    }

    const id = crypto.randomUUID();
    await db.insert(resumeReviewPresence).values({
      id,
      shareId: data.shareId,
      resumeId: data.resumeId,
      userId: data.userId,
      reviewerName: data.reviewerName,
      reviewerEmail: data.reviewerEmail || null,
      reviewerAvatarUrl: data.reviewerAvatarUrl || null,
      cursorX: Math.round(data.cursorX),
      cursorY: Math.round(data.cursorY),
      color: data.color,
    });
    const rows = await db.select().from(resumeReviewPresence).where(eq(resumeReviewPresence.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async findActivePresence(shareId: string, since: Date) {
    return db
      .select()
      .from(resumeReviewPresence)
      .where(and(eq(resumeReviewPresence.shareId, shareId), gt(resumeReviewPresence.lastSeenAt, since)))
      .orderBy(desc(resumeReviewPresence.lastSeenAt));
  },
};
