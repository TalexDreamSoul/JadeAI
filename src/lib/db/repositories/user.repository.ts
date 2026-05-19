import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { db } from '../index';
import { users, resumes } from '../schema';
import { resumeRepository } from './resume.repository';
import { createSampleResume } from '../sample-resume';

function normalizeSettings(settings: unknown): Record<string, unknown> {
  if (!settings) return {};
  if (typeof settings === 'string') {
    try {
      const parsed = JSON.parse(settings);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return typeof settings === 'object' && !Array.isArray(settings) ? settings as Record<string, unknown> : {};
}

export const userRepository = {
  async findById(id: string) {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0] || null;
  },

  async list() {
    return db.select().from(users).orderBy(desc(users.createdAt));
  },

  async findByEmail(email: string) {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0] || null;
  },

  async findByFingerprint(fingerprint: string) {
    const result = await db.select().from(users).where(eq(users.fingerprint, fingerprint)).limit(1);
    return result[0] || null;
  },

  async findFirstAdmin() {
    const result = await db.select().from(users).where(eq(users.role, 'admin')).limit(1);
    return result[0] || null;
  },

  async getGlobalSettings() {
    const admin = await this.findFirstAdmin();
    return normalizeSettings(admin?.settings);
  },

  async updateGlobalSettings(settings: Record<string, unknown>) {
    const admin = await this.findFirstAdmin();
    if (!admin) return {};
    const current = normalizeSettings(admin.settings);
    const merged = { ...current, ...settings };
    await db.update(users).set({ settings: merged, updatedAt: new Date() }).where(eq(users.id, admin.id));
    return merged;
  },

  async upsertByFingerprint(fingerprint: string) {
    const existing = await this.findByFingerprint(fingerprint);
    if (existing) return existing;

    const id = crypto.randomUUID();
    await db.insert(users).values({
      id,
      fingerprint,
      authType: 'fingerprint',
      name: 'Anonymous User',
    });

    // Clone demo user's resumes, or create a sample if seed hasn't run
    const demoUser = await this.findByFingerprint('demo-fingerprint');
    if (demoUser) {
      const demoResumes = await db.select().from(resumes).where(eq(resumes.userId, demoUser.id));
      for (const r of demoResumes) {
        await resumeRepository.duplicate(r.id, id, r.title);
      }
    } else {
      await createSampleResume(id);
    }

    return this.findById(id);
  },

  async create(data: {
    id?: string;
    email?: string;
    passwordHash?: string;
    name?: string;
    avatarUrl?: string;
    authType: 'oauth' | 'fingerprint' | 'password';
    fingerprint?: string;
    role?: 'user' | 'admin';
  }) {
    const id = data.id || crypto.randomUUID();
    await db.insert(users).values({ ...data, id });
    return this.findById(id);
  },

  async update(id: string, data: Partial<{ name: string; avatarUrl: string; role: 'user' | 'admin'; aiCredits: number }>) {
    await db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, id));
    return this.findById(id);
  },

  async consumeAICredit(id: string): Promise<boolean> {
    const user = await this.findById(id);
    if (!user || user.role === 'admin') return !!user;

    const result = await db.update(users)
      .set({ aiCredits: sql`${users.aiCredits} - 1`, updatedAt: new Date() })
      .where(and(eq(users.id, id), gt(users.aiCredits, 0)));

    const outcome = result as { changes?: number; rowCount?: number; count?: number | string | bigint };
    const changes = Number(outcome.changes ?? outcome.rowCount ?? outcome.count ?? 0);
    return changes > 0;
  },

  async getSettings(id: string) {
    const result = await db.select({ settings: users.settings }).from(users).where(eq(users.id, id)).limit(1);
    return normalizeSettings(result[0]?.settings);
  },

  async updateSettings(id: string, settings: Record<string, unknown>) {
    const current = await this.getSettings(id);
    const merged = { ...current, ...settings };
    await db.update(users).set({ settings: merged, updatedAt: new Date() }).where(eq(users.id, id));
    return merged;
  },
};
