import { desc, eq } from 'drizzle-orm';
import { db } from '../index';
import { users, resumes } from '../schema';
import { resumeRepository } from './resume.repository';
import { createSampleResume } from '../sample-resume';
import { ensureUserCommercialDefaults } from '@/lib/commercial/bootstrap';
import type { AIConfig } from '@/lib/ai/provider';
import { WALLET_CURRENCY_AI_CREDIT } from '@/lib/commercial/catalog';
import { chargeLegacyCompatibleAIUsage, reserveAIUsage } from '@/lib/commercial/ai-metering-service';
import { syncLegacyAICredits, walletRepository } from './commercial.repository';
import type { AIUsageReservation } from '@/lib/commercial/ai-metering-service';

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

    await ensureUserCommercialDefaults(id, 0).catch(() => null);
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
    await ensureUserCommercialDefaults(id, 0).catch(() => null);
    return this.findById(id);
  },

  async update(id: string, data: Partial<{ name: string; avatarUrl: string; role: 'user' | 'admin'; aiCredits: number }>) {
    const existing = await this.findById(id);
    if (!existing) return null;

    const { aiCredits, ...profilePatch } = data;
    await db.update(users).set({ ...profilePatch, updatedAt: new Date() }).where(eq(users.id, id));
    if (aiCredits !== undefined) {
      await this.setAICredits(id, aiCredits, 'admin_adjust');
    }
    return this.findById(id);
  },

  async setAICredits(id: string, aiCredits: number, source = 'manual_adjust') {
    const nextBalance = Math.max(0, Math.floor(Number(aiCredits) || 0));
    await ensureUserCommercialDefaults(id, 0);
    const account = await walletRepository.ensureAccount(id, WALLET_CURRENCY_AI_CREDIT);
    const currentBalance = Number(account?.balance || 0);
    const delta = nextBalance - currentBalance;
    if (delta > 0) {
      await walletRepository.credit({
        userId: id,
        currency: WALLET_CURRENCY_AI_CREDIT,
        amount: delta,
        source,
        sourceId: crypto.randomUUID(),
        description: '管理员调整 AI 点数',
        metadata: { previousBalance: currentBalance, nextBalance },
      });
    } else if (delta < 0) {
      await walletRepository.debit({
        userId: id,
        currency: WALLET_CURRENCY_AI_CREDIT,
        amount: Math.abs(delta),
        source,
        sourceId: crypto.randomUUID(),
        description: '管理员调整 AI 点数',
        metadata: { previousBalance: currentBalance, nextBalance },
      });
    }
    await syncLegacyAICredits(id, nextBalance);
    return walletRepository.findAccount(id, WALLET_CURRENCY_AI_CREDIT);
  },

  async consumeAICredit(id: string, usage?: {
    feature?: string;
    aiConfig?: Pick<AIConfig, 'provider' | 'model' | 'mode'>;
    credits?: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    metadata?: Record<string, unknown>;
  }): Promise<boolean> {
    const user = await this.findById(id);
    if (!user || user.role === 'admin') return !!user;

    return chargeLegacyCompatibleAIUsage({
      userId: id,
      feature: usage?.feature || 'legacy_ai_call',
      aiConfig: usage?.aiConfig,
      credits: usage?.credits,
      promptTokens: usage?.promptTokens,
      completionTokens: usage?.completionTokens,
      totalTokens: usage?.totalTokens,
      metadata: usage?.metadata,
      legacyAiCredits: Number(user.aiCredits || 0),
    });
  },

  async reserveAICredit(id: string, usage?: {
    feature?: string;
    aiConfig?: Pick<AIConfig, 'provider' | 'model' | 'mode'>;
    credits?: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    metadata?: Record<string, unknown>;
  }): Promise<{ ok: true; reservation: AIUsageReservation | null } | { ok: false; error: string }> {
    const user = await this.findById(id);
    if (!user) return { ok: false, error: 'User not found' };
    if (user.role === 'admin') return { ok: true, reservation: null };

    const reservation = await reserveAIUsage({
      userId: id,
      feature: usage?.feature || 'legacy_ai_call',
      aiConfig: usage?.aiConfig,
      credits: usage?.credits,
      promptTokens: usage?.promptTokens,
      completionTokens: usage?.completionTokens,
      totalTokens: usage?.totalTokens,
      metadata: usage?.metadata,
      legacyAiCredits: Number(user.aiCredits || 0),
    });
    if (!reservation) return { ok: false, error: 'AI credits exhausted' };
    return { ok: true, reservation };
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

  async replaceSettings(id: string, settings: Record<string, unknown>) {
    await db.update(users).set({ settings, updatedAt: new Date() }).where(eq(users.id, id));
    return settings;
  },
};
