import { eq } from 'drizzle-orm';
import { db, dbReady } from '@/lib/db';
import {
  MEMBERSHIP_PLANS,
  PRODUCT_SEEDS,
  QUESTION_BANK_SEEDS,
  REDEEM_CODE_SEEDS,
  RESUME_TEMPLATE_MARKET_SEEDS,
  WALLET_CURRENCY_AI_CREDIT,
} from './catalog';
import { syncActiveMembershipMonthlyAICredits } from './membership-credit-service';
import {
  interviewQuestionBankRepository,
  membershipRepository,
  productRepository,
  redeemCodeRepository,
  syncLegacyAICredits,
  walletRepository,
} from '@/lib/db/repositories/commercial.repository';
import { templateMarketRepository } from '@/lib/db/repositories/template-market.repository';
import { users } from '@/lib/db/schema';

let bootstrapPromise: Promise<void> | null = null;
const LEGACY_AI_CREDITS_SOURCE_ID = 'legacy_ai_credits_initial_migration';

async function findSystemOwner() {
  const admins = await db.select().from(users).where(eq(users.role, 'admin')).limit(1);
  return admins[0] ?? null;
}

export async function ensureCommercialCatalog() {
  if (!bootstrapPromise) {
    bootstrapPromise = bootstrapCommercialCatalog().catch((error) => {
      bootstrapPromise = null;
      throw error;
    });
  }
  return bootstrapPromise;
}

async function bootstrapCommercialCatalog() {
  await dbReady;

  for (const seed of MEMBERSHIP_PLANS) {
    const plan = await membershipRepository.upsertPlan({
      key: seed.key,
      name: seed.name,
      description: seed.description,
      tier: seed.tier,
      priceCents: seed.priceCents,
      metadata: { systemSeed: true },
    });
    if (plan) {
      await membershipRepository.replacePlanEntitlements(plan.id, seed.entitlements);
    }
  }

  for (const seed of PRODUCT_SEEDS) {
    await productRepository.upsert({
      sku: seed.sku,
      type: seed.type,
      name: seed.name,
      description: seed.description,
      priceCents: seed.priceCents,
      currency: seed.currency || 'CNY',
      resourceType: seed.resourceType,
      resourceId: seed.resourceId,
      metadata: seed.metadata || {},
    });
  }

  const systemOwner = await findSystemOwner();
  if (systemOwner) {
    for (const seed of RESUME_TEMPLATE_MARKET_SEEDS) {
      const template = await templateMarketRepository.upsertSystemTemplate({
        ownerUserId: systemOwner.id,
        name: seed.name,
        description: seed.description,
        baseTemplate: seed.baseTemplate,
        themeConfig: seed.themeConfig || {},
        customCss: seed.customCss || '',
        isPublic: true,
      });
      if (template) {
        await productRepository.upsert({
          sku: `resume-template-${template.id}`,
          type: 'resume_template',
          name: seed.name,
          description: seed.description,
          priceCents: seed.priceCents,
          resourceType: 'resume_template',
          resourceId: template.id,
          metadata: {
            systemSeed: true,
            seedKey: seed.key,
            baseTemplate: seed.baseTemplate,
          },
        });
      }
    }
  }

  for (const seed of QUESTION_BANK_SEEDS) {
    const bank = await interviewQuestionBankRepository.upsertBank({
      key: seed.key,
      title: seed.title,
      description: seed.description,
      industry: seed.industry,
      role: seed.role,
      level: seed.level,
      companyType: seed.companyType,
      accessLevel: seed.accessLevel,
      metadata: { systemSeed: true },
    });
    if (bank) {
      await interviewQuestionBankRepository.upsertSeedQuestions(bank.id, seed.questions);
      await productRepository.upsert({
        sku: `question-bank-${seed.key}`,
        type: 'interview_question_bank',
        name: seed.title,
        description: seed.description,
        priceCents: seed.accessLevel === 'premium' ? 2990 : 990,
        resourceType: 'interview_question_bank',
        resourceId: bank.id,
        metadata: {
          accessLevel: seed.accessLevel,
          questionCount: seed.questions.length,
        },
      });
    }
  }

  for (const seed of REDEEM_CODE_SEEDS) {
    await redeemCodeRepository.upsert({
      code: seed.code,
      type: seed.type,
      maxClaims: seed.maxClaims,
      benefit: seed.benefit,
    });
  }
}

export async function ensureUserCommercialDefaults(userId: string, legacyAiCredits = 0) {
  await ensureCommercialCatalog();
  const initialAccount = await walletRepository.ensureAccount(userId, WALLET_CURRENCY_AI_CREDIT);
  const legacyMigrated = await walletRepository.hasTransaction(
    userId,
    'legacy_ai_credits',
    LEGACY_AI_CREDITS_SOURCE_ID,
  );
  const currentAICredits = Number(initialAccount?.balance || 0);
  const legacyCreditDelta = Math.max(0, Math.floor(Number(legacyAiCredits || 0)) - currentAICredits);
  if (!legacyMigrated && legacyCreditDelta > 0) {
    await walletRepository.credit({
      userId,
      currency: WALLET_CURRENCY_AI_CREDIT,
      amount: legacyCreditDelta,
      source: 'legacy_ai_credits',
      sourceId: LEGACY_AI_CREDITS_SOURCE_ID,
      description: '迁移旧 AI 额度',
      metadata: {
        legacyAiCredits,
        previousWalletBalance: currentAICredits,
      },
    });
  }

  const activeMembership = await membershipRepository.getActiveMembership(userId);
  if (!activeMembership) {
    await membershipRepository.grantMembership({
      userId,
      planKey: 'free',
      source: 'system',
      metadata: { reason: 'default_free_plan' },
    });
  }
  await syncActiveMembershipMonthlyAICredits(userId);
  const account = await walletRepository.findAccount(userId, WALLET_CURRENCY_AI_CREDIT);
  await syncLegacyAICredits(userId, Number(account?.balance || 0));
}
