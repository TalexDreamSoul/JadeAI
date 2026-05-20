import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../index';
import { resumeReviewComments, resumeReviewPresence, resumes, resumeSections, resumeEvents, resumeShares, resumeVersions, users } from '../schema';
import { DEFAULT_TEMPLATE } from '@/lib/constants';

type ResumeCreateData = {
  userId: string;
  title?: string;
  template?: string;
  language?: string;
  themeConfig?: unknown;
  isBase?: boolean;
  cloudSyncEnabled?: boolean;
  sourceResumeId?: string | null;
  baseResumeId?: string | null;
  targetCompany?: string | null;
  targetJobTitle?: string | null;
  jobDescription?: string | null;
  versionLabel?: string;
};

type ResumeUpdateData = Partial<{
  title: string;
  template: string;
  themeConfig: unknown;
  language: string;
  isBase: boolean;
  cloudSyncEnabled: boolean;
  sourceResumeId: string | null;
  baseResumeId: string | null;
  targetCompany: string | null;
  targetJobTitle: string | null;
  jobDescription: string | null;
  versionLabel: string;
}>;

export const resumeRepository = {
  async findAllByUserId(userId: string) {
    return db.select().from(resumes).where(eq(resumes.userId, userId)).orderBy(desc(resumes.updatedAt));
  },

  async findById(id: string) {
    const resume = await db.select().from(resumes).where(eq(resumes.id, id)).limit(1);
    if (!resume[0]) return null;
    const sections = await db.select().from(resumeSections).where(eq(resumeSections.resumeId, id)).orderBy(resumeSections.sortOrder);
    return { ...resume[0], sections };
  },

  async findFamilyIdsByResumeId(id: string, userId: string) {
    const rows = await db
      .select({ id: resumes.id, baseResumeId: resumes.baseResumeId, sourceResumeId: resumes.sourceResumeId })
      .from(resumes)
      .where(eq(resumes.userId, userId)) as Array<{ id: string; baseResumeId: string | null; sourceResumeId: string | null }>;
    const current = rows.find((resume) => resume.id === id);
    if (!current) return [];
    const rootId = current.baseResumeId || current.id;
    return Array.from(new Set(rows
      .filter((resume) => (
        resume.id === id ||
        resume.id === rootId ||
        resume.baseResumeId === rootId ||
        resume.sourceResumeId === rootId
      ))
      .map((resume) => resume.id)));
  },

  async findOwnerByResumeId(id: string) {
    const rows = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(resumes)
      .leftJoin(users, eq(resumes.userId, users.id))
      .where(eq(resumes.id, id))
      .limit(1);
    return rows[0] ?? null;
  },

  async create(data: ResumeCreateData) {
    const id = crypto.randomUUID();
    await db.insert(resumes).values({
      id,
      userId: data.userId,
      title: data.title || '未命名简历',
      template: data.template || DEFAULT_TEMPLATE,
      language: data.language || 'zh',
      ...(data.themeConfig !== undefined ? { themeConfig: data.themeConfig } : {}),
      ...(data.isBase !== undefined ? { isBase: data.isBase } : {}),
      ...(data.cloudSyncEnabled !== undefined ? { cloudSyncEnabled: data.cloudSyncEnabled } : {}),
      ...(data.sourceResumeId !== undefined ? { sourceResumeId: data.sourceResumeId } : {}),
      ...(data.baseResumeId !== undefined ? { baseResumeId: data.baseResumeId } : {}),
      ...(data.targetCompany !== undefined ? { targetCompany: data.targetCompany } : {}),
      ...(data.targetJobTitle !== undefined ? { targetJobTitle: data.targetJobTitle } : {}),
      ...(data.jobDescription !== undefined ? { jobDescription: data.jobDescription } : {}),
      ...(data.versionLabel !== undefined ? { versionLabel: data.versionLabel } : {}),
    });
    return this.findById(id);
  },

  async update(id: string, data: ResumeUpdateData) {
    await db.update(resumes).set({ ...data, updatedAt: new Date() }).where(eq(resumes.id, id));
    return this.findById(id);
  },

  async delete(id: string) {
    await db.delete(resumes).where(eq(resumes.id, id));
  },

  async purgeCloudDataForLocalOnly(id: string) {
    await db.delete(resumeReviewComments).where(eq(resumeReviewComments.resumeId, id));
    await db.delete(resumeReviewPresence).where(eq(resumeReviewPresence.resumeId, id));
    await db.delete(resumeShares).where(eq(resumeShares.resumeId, id));
    await db.delete(resumeVersions).where(eq(resumeVersions.resumeId, id));
    await db.delete(resumeEvents).where(eq(resumeEvents.resumeId, id));
    await db.delete(resumeSections).where(eq(resumeSections.resumeId, id));
    await db.update(resumes).set({
      cloudSyncEnabled: false,
      shareToken: null,
      isPublic: false,
      sharePassword: null,
      viewCount: 0,
      updatedAt: new Date(),
    }).where(eq(resumes.id, id));
  },

  async duplicate(
    id: string,
    userId: string,
    titleOverride?: string,
    options?: Partial<Pick<ResumeCreateData, 'baseResumeId' | 'targetCompany' | 'targetJobTitle' | 'jobDescription' | 'versionLabel'>>
  ) {
    const original = await this.findById(id);
    if (!original) return null;

    const newId = crypto.randomUUID();
    await db.insert(resumes).values({
      id: newId,
      userId,
      title: titleOverride ?? `${original.title} (副本)`,
      template: original.template,
      themeConfig: original.themeConfig,
      language: original.language,
      sourceResumeId: original.id,
      baseResumeId: options?.baseResumeId ?? original.baseResumeId ?? (original.isBase ? original.id : null),
      targetCompany: options?.targetCompany ?? null,
      targetJobTitle: options?.targetJobTitle ?? null,
      jobDescription: options?.jobDescription ?? null,
      versionLabel: options?.versionLabel ?? 'v1',
    });

    for (const section of original.sections) {
      await db.insert(resumeSections).values({
        id: crypto.randomUUID(),
        resumeId: newId,
        type: section.type,
        title: section.title,
        sortOrder: section.sortOrder,
        visible: section.visible,
        content: section.content,
      });
    }

    return this.findById(newId);
  },

  async createVersion(resumeId: string, label: string, snapshot: unknown, source = 'manual') {
    const id = crypto.randomUUID();
    await db.insert(resumeVersions).values({
      id,
      resumeId,
      label,
      snapshot,
      source,
    });
    const rows = await db.select().from(resumeVersions).where(eq(resumeVersions.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async findVersions(resumeId: string) {
    return db
      .select()
      .from(resumeVersions)
      .where(eq(resumeVersions.resumeId, resumeId))
      .orderBy(desc(resumeVersions.createdAt));
  },

  async createEvent(data: {
    resumeId: string;
    userId: string;
    type: string;
    title: string;
    description?: string;
    metadata?: unknown;
  }) {
    const id = crypto.randomUUID();
    await db.insert(resumeEvents).values({
      id,
      resumeId: data.resumeId,
      userId: data.userId,
      type: data.type,
      title: data.title,
      description: data.description || '',
      metadata: data.metadata || {},
    });
    const rows = await db.select().from(resumeEvents).where(eq(resumeEvents.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async findEvents(resumeId: string) {
    return db
      .select()
      .from(resumeEvents)
      .where(eq(resumeEvents.resumeId, resumeId))
      .orderBy(desc(resumeEvents.createdAt));
  },

  // Share operations
  async findByShareToken(token: string) {
    const resume = await db.select().from(resumes).where(eq(resumes.shareToken, token)).limit(1);
    if (!resume[0]) return null;
    const sections = await db.select().from(resumeSections).where(eq(resumeSections.resumeId, resume[0].id)).orderBy(resumeSections.sortOrder);
    return { ...resume[0], sections };
  },

  async incrementViewCount(id: string) {
    await db.update(resumes).set({ viewCount: sql`${resumes.viewCount} + 1` }).where(eq(resumes.id, id));
  },

  async updateShareSettings(id: string, settings: { isPublic?: boolean; shareToken?: string | null; sharePassword?: string | null }) {
    await db.update(resumes).set({ ...settings, updatedAt: new Date() }).where(eq(resumes.id, id));
  },

  // Section operations
  async createSection(data: { id?: string; resumeId: string; type: string; title: string; sortOrder: number; visible?: boolean; content?: unknown }) {
    const id = data.id || crypto.randomUUID();
    await db.insert(resumeSections).values({
      id,
      resumeId: data.resumeId,
      type: data.type,
      title: data.title,
      sortOrder: data.sortOrder,
      visible: data.visible ?? true,
      content: data.content || {},
    });
    const rows = await db.select().from(resumeSections).where(eq(resumeSections.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async updateSection(id: string, data: Partial<{ title: string; sortOrder: number; visible: boolean; content: unknown }>) {
    await db.update(resumeSections).set({ ...data, updatedAt: new Date() }).where(eq(resumeSections.id, id));
  },

  async deleteSection(id: string) {
    await db.delete(resumeSections).where(eq(resumeSections.id, id));
  },

  async updateSectionOrder(sections: { id: string; sortOrder: number }[]) {
    for (const s of sections) {
      await db.update(resumeSections).set({ sortOrder: s.sortOrder, updatedAt: new Date() }).where(eq(resumeSections.id, s.id));
    }
  },
};
