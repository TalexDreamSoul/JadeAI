import { asc, desc, eq } from 'drizzle-orm';
import { db } from '../index';
import { jobTemplates } from '../schema';
import type { JobTemplate } from '@/lib/career/job-templates';

export type JobTemplateRecord = typeof jobTemplates.$inferSelect;

type JobTemplateInput = {
  ownerUserId: string;
  roleKey: string;
  title: string;
  level: JobTemplate['level'];
  industry: string;
  jd: string;
  keywords: string[];
  interviewQuestions: string[];
  recommendedSections: string[];
  enabled?: boolean;
  sortOrder?: number;
};

function normalizeList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[,，、;；\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeLevel(value: unknown): JobTemplate['level'] {
  return value === 'intern' || value === 'junior' || value === 'senior' ? value : 'mid';
}

export function toJobTemplate(row: JobTemplateRecord): JobTemplate {
  return {
    roleKey: row.roleKey,
    title: row.title,
    level: normalizeLevel(row.level),
    industry: row.industry,
    jd: row.jd,
    keywords: normalizeList(row.keywords),
    interviewQuestions: normalizeList(row.interviewQuestions),
    recommendedSections: normalizeList(row.recommendedSections),
  };
}

export const jobTemplateRepository = {
  async listAll() {
    return db.select().from(jobTemplates).orderBy(asc(jobTemplates.sortOrder), desc(jobTemplates.updatedAt));
  },

  async listEnabled() {
    return db
      .select()
      .from(jobTemplates)
      .where(eq(jobTemplates.enabled, true))
      .orderBy(asc(jobTemplates.sortOrder), desc(jobTemplates.updatedAt));
  },

  async findById(id: string) {
    const rows = await db.select().from(jobTemplates).where(eq(jobTemplates.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async create(data: JobTemplateInput) {
    const id = crypto.randomUUID();
    await db.insert(jobTemplates).values({
      id,
      ownerUserId: data.ownerUserId,
      roleKey: data.roleKey,
      title: data.title,
      level: data.level,
      industry: data.industry,
      jd: data.jd,
      keywords: data.keywords,
      interviewQuestions: data.interviewQuestions,
      recommendedSections: data.recommendedSections,
      enabled: data.enabled ?? true,
      sortOrder: data.sortOrder ?? 1000,
    });
    return this.findById(id);
  },

  async update(id: string, data: Partial<Omit<JobTemplateInput, 'ownerUserId'>>) {
    await db
      .update(jobTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(jobTemplates.id, id));
    return this.findById(id);
  },
};

