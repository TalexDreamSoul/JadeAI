import { and, desc, eq, gt, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { db } from '../index';
import {
  aiUsageLogs,
  interviewQuestionBanks,
  interviewQuestionFavorites,
  interviewQuestionPracticeAttempts,
  interviewQuestionStats,
  interviewQuestions,
  lotteryCampaigns,
  lotteryDraws,
  membershipPlans,
  notifications,
  orderItems,
  orders,
  payments,
  planEntitlements,
  products,
  redeemCodeClaims,
  redeemCodes,
  referralRelations,
  userEntitlements,
  userMemberships,
  users,
  walletAccounts,
  walletTransactions,
} from '../schema';

export type WalletCurrency = 'AI_CREDIT' | 'POINT' | 'CASH_BALANCE' | string;

type JsonRecord = Record<string, unknown>;
type ProductRecord = typeof products.$inferSelect;
type OrderRecord = typeof orders.$inferSelect;
type OrderItemRecord = typeof orderItems.$inferSelect;
type PaymentRecord = typeof payments.$inferSelect;
type DetailedOrderRecord = OrderRecord & {
  items: OrderItemRecord[];
  payments: PaymentRecord[];
};
type InterviewQuestionRecord = typeof interviewQuestions.$inferSelect;

function now() {
  return new Date();
}

function jsonRecord(value: unknown): JsonRecord {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as JsonRecord : {};
    } catch {
      return {};
    }
  }
  return typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function timestampPlusDays(days: number, from: Date = new Date()) {
  const date = new Date(from);
  date.setDate(date.getDate() + days);
  return date;
}

function normalizedDate(value: Date | number | string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function laterDate(left: Date | null, right: Date) {
  return left && left.getTime() > right.getTime() ? left : right;
}

function membershipSourceKey(source: string, sourceId?: string | null) {
  return sourceId ? `${source}:${sourceId}` : '';
}

function membershipSourceKeys(metadata: unknown) {
  const value = jsonRecord(metadata).renewalSourceKeys;
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function endsAtLeastAsLate(existingEnd: Date | number | string | null, incomingEnd: Date | null) {
  if (!existingEnd) return true;
  if (!incomingEnd) return false;
  const existing = normalizedDate(existingEnd);
  return Boolean(existing && existing.getTime() >= incomingEnd.getTime());
}

function orderNo() {
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
  return `JA${Date.now()}${suffix}`;
}

function walletAccountId(userId: string, currency: WalletCurrency) {
  return `wallet:${userId}:${currency}`;
}

function walletTransactionId(data: {
  userId: string;
  currency: WalletCurrency;
  direction: 'credit' | 'debit';
  source: string;
  sourceId?: string | null;
}) {
  if (!data.sourceId) return crypto.randomUUID();
  return `wallet_tx:${data.userId}:${data.currency}:${data.direction}:${data.source}:${data.sourceId}`;
}

export const membershipRepository = {
  async listPlans(activeOnly = true) {
    if (activeOnly) {
      return db.select().from(membershipPlans).where(eq(membershipPlans.active, true));
    }
    return db.select().from(membershipPlans);
  },

  async findPlanByKey(key: string) {
    const rows = await db.select().from(membershipPlans).where(eq(membershipPlans.key, key)).limit(1);
    return rows[0] ?? null;
  },

  async upsertPlan(data: {
    key: string;
    name: string;
    description: string;
    tier: number;
    priceCents: number;
    currency?: string;
    billingCycle?: string;
    metadata?: JsonRecord;
  }) {
    const existing = await this.findPlanByKey(data.key);
    if (existing) {
      await db
        .update(membershipPlans)
        .set({
          name: data.name,
          description: data.description,
          tier: data.tier,
          priceCents: data.priceCents,
          currency: data.currency || existing.currency,
          billingCycle: data.billingCycle || existing.billingCycle,
          metadata: data.metadata || existing.metadata || {},
          active: true,
          updatedAt: now(),
        })
        .where(eq(membershipPlans.id, existing.id));
      return this.findPlanByKey(data.key);
    }

    const id = crypto.randomUUID();
    await db.insert(membershipPlans).values({
      id,
      key: data.key,
      name: data.name,
      description: data.description,
      tier: data.tier,
      priceCents: data.priceCents,
      currency: data.currency || 'CNY',
      billingCycle: data.billingCycle || 'month',
      metadata: data.metadata || {},
    });
    return this.findPlanByKey(data.key);
  },

  async replacePlanEntitlements(planId: string, entitlements: Record<string, unknown>) {
    await db.delete(planEntitlements).where(eq(planEntitlements.planId, planId));
    const rows = Object.entries(entitlements).map(([key, value]) => ({
      id: crypto.randomUUID(),
      planId,
      key,
      value: { value },
    }));
    if (rows.length) await db.insert(planEntitlements).values(rows);
  },

  async listPlanEntitlements(planId: string) {
    return db.select().from(planEntitlements).where(eq(planEntitlements.planId, planId));
  },

  async getActiveMembership(userId: string) {
    const rows = await db
      .select({
        membership: userMemberships,
        plan: membershipPlans,
      })
      .from(userMemberships)
      .innerJoin(membershipPlans, eq(userMemberships.planId, membershipPlans.id))
      .where(and(
        eq(userMemberships.userId, userId),
        eq(userMemberships.status, 'active'),
        or(isNull(userMemberships.currentPeriodEnd), gt(userMemberships.currentPeriodEnd, now())),
      ))
      .orderBy(desc(membershipPlans.tier), desc(userMemberships.createdAt))
      .limit(1);
    return rows[0] ?? null;
  },

  async findMembershipBySource(userId: string, source: string, sourceId: string) {
    const rows = await db
      .select({
        membership: userMemberships,
        plan: membershipPlans,
      })
      .from(userMemberships)
      .innerJoin(membershipPlans, eq(userMemberships.planId, membershipPlans.id))
      .where(and(
        eq(userMemberships.userId, userId),
        eq(userMemberships.source, source),
        eq(userMemberships.sourceId, sourceId),
      ))
      .orderBy(desc(userMemberships.createdAt))
      .limit(1);
    if (rows[0]) return rows[0];

    const key = membershipSourceKey(source, sourceId);
    if (!key) return null;
    const candidates = await db
      .select({
        membership: userMemberships,
        plan: membershipPlans,
      })
      .from(userMemberships)
      .innerJoin(membershipPlans, eq(userMemberships.planId, membershipPlans.id))
      .where(eq(userMemberships.userId, userId))
      .orderBy(desc(userMemberships.createdAt));
    return candidates.find((item: { membership: typeof userMemberships.$inferSelect }) => (
      membershipSourceKeys(item.membership.metadata).includes(key)
    )) ?? null;
  },

  async grantMembership(data: {
    userId: string;
    planKey: string;
    source: string;
    sourceId?: string;
    durationDays?: number;
    metadata?: JsonRecord;
  }) {
    const plan = await this.findPlanByKey(data.planKey);
    if (!plan) throw new Error(`Membership plan not found: ${data.planKey}`);
    const currentPeriodEnd = data.durationDays ? timestampPlusDays(data.durationDays) : null;
    const activeMembership = await this.getActiveMembership(data.userId);
    const activeTier = Number(activeMembership?.plan.tier || 0);
    const nextTier = Number(plan.tier || 0);
    if (
      activeMembership &&
      activeMembership.membership.source === data.source &&
      activeMembership.membership.sourceId === data.sourceId
    ) {
      return activeMembership;
    }
    if (activeMembership && activeMembership.plan.key === plan.key && data.durationDays) {
      const currentEnd = normalizedDate(activeMembership.membership.currentPeriodEnd);
      if (!currentEnd) return activeMembership;
      const nextEnd = timestampPlusDays(data.durationDays, laterDate(currentEnd, now()));
      const renewalSourceKeys = Array.from(new Set([
        ...membershipSourceKeys(activeMembership.membership.metadata),
        membershipSourceKey(activeMembership.membership.source, activeMembership.membership.sourceId),
        membershipSourceKey(data.source, data.sourceId),
      ].filter(Boolean)));
      await db
        .update(userMemberships)
        .set({
          source: data.source,
          sourceId: data.sourceId,
          currentPeriodEnd: nextEnd,
          metadata: {
            ...jsonRecord(activeMembership.membership.metadata),
            ...(data.metadata || {}),
            renewedFromMembershipId: activeMembership.membership.id,
            renewalSourceKeys,
          },
          updatedAt: now(),
        })
        .where(eq(userMemberships.id, activeMembership.membership.id));
      await entitlementRepository.extendMembershipBenefitEntitlements(
        data.userId,
        activeMembership.membership.id,
        nextEnd,
      );
      return this.getActiveMembership(data.userId);
    }
    if (
      activeMembership &&
      (
        activeTier > nextTier ||
        (
          activeTier === nextTier &&
          endsAtLeastAsLate(activeMembership.membership.currentPeriodEnd, currentPeriodEnd)
        )
      )
    ) {
      return activeMembership;
    }

    await db
      .update(userMemberships)
      .set({ status: 'replaced', updatedAt: now() })
      .where(and(eq(userMemberships.userId, data.userId), eq(userMemberships.status, 'active')));

    const id = crypto.randomUUID();
    await db.insert(userMemberships).values({
      id,
      userId: data.userId,
      planId: plan.id,
      status: 'active',
      source: data.source,
      sourceId: data.sourceId,
      currentPeriodStart: now(),
      currentPeriodEnd,
      metadata: data.metadata || {},
    });
    return this.getActiveMembership(data.userId);
  },
};

export const productRepository = {
  async list(activeOnly = true) {
    if (activeOnly) {
      return db
        .select()
        .from(products)
        .where(eq(products.active, true))
        .orderBy(desc(products.updatedAt));
    }
    return db.select().from(products).orderBy(desc(products.updatedAt));
  },

  async listByIds(ids: string[]) {
    if (!ids.length) return [];
    return db.select().from(products).where(inArray(products.id, ids));
  },

  async findById(id: string) {
    const rows = await db.select().from(products).where(eq(products.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async findBySku(sku: string) {
    const rows = await db.select().from(products).where(eq(products.sku, sku)).limit(1);
    return rows[0] ?? null;
  },

  async upsert(data: {
    sku: string;
    type: string;
    name: string;
    description: string;
    priceCents: number;
    currency?: string;
    resourceType?: string;
    resourceId?: string;
    metadata?: JsonRecord;
  }) {
    const existing = await this.findBySku(data.sku);
    if (existing) {
      await db
        .update(products)
        .set({
          type: data.type,
          name: data.name,
          description: data.description,
          priceCents: data.priceCents,
          currency: data.currency || existing.currency,
          resourceType: data.resourceType,
          resourceId: data.resourceId,
          metadata: data.metadata || {},
          active: true,
          updatedAt: now(),
        })
        .where(eq(products.id, existing.id));
      return this.findBySku(data.sku);
    }

    const id = crypto.randomUUID();
    await db.insert(products).values({
      id,
      sku: data.sku,
      type: data.type,
      name: data.name,
      description: data.description,
      priceCents: data.priceCents,
      currency: data.currency || 'CNY',
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      metadata: data.metadata || {},
    });
    return this.findBySku(data.sku);
  },

  async update(id: string, data: Partial<{
    type: string;
    sku: string;
    name: string;
    description: string;
    priceCents: number;
    currency: string;
    resourceType: string | null;
    resourceId: string | null;
    active: boolean;
    metadata: JsonRecord;
  }>) {
    await db
      .update(products)
      .set({
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.sku !== undefined ? { sku: data.sku } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.priceCents !== undefined ? { priceCents: data.priceCents } : {}),
        ...(data.currency !== undefined ? { currency: data.currency } : {}),
        ...(data.resourceType !== undefined ? { resourceType: data.resourceType } : {}),
        ...(data.resourceId !== undefined ? { resourceId: data.resourceId } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
        ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
        updatedAt: now(),
      })
      .where(eq(products.id, id));
    return this.findById(id);
  },
};

export const entitlementRepository = {
  async grant(data: {
    userId: string;
    key: string;
    value?: unknown;
    resourceType?: string | null;
    resourceId?: string | null;
    source: string;
    sourceId?: string;
    startsAt?: Date | null;
    expiresAt?: Date | null;
  }) {
    const id = crypto.randomUUID();
    await db.insert(userEntitlements).values({
      id,
      userId: data.userId,
      key: data.key,
      value: { value: data.value ?? true },
      resourceType: data.resourceType || null,
      resourceId: data.resourceId || null,
      source: data.source,
      sourceId: data.sourceId,
      startsAt: data.startsAt || now(),
      expiresAt: data.expiresAt || null,
    });
    return this.findById(id);
  },

  async findById(id: string) {
    const rows = await db.select().from(userEntitlements).where(eq(userEntitlements.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async listForUser(userId: string) {
    return db
      .select()
      .from(userEntitlements)
      .where(and(
        eq(userEntitlements.userId, userId),
        lte(userEntitlements.startsAt, now()),
        or(isNull(userEntitlements.expiresAt), gt(userEntitlements.expiresAt, now())),
      ))
      .orderBy(desc(userEntitlements.createdAt));
  },

  async hasResource(userId: string, resourceType: string, resourceId: string) {
    const rows = await db
      .select({ id: userEntitlements.id })
      .from(userEntitlements)
      .where(and(
        eq(userEntitlements.userId, userId),
        eq(userEntitlements.resourceType, resourceType),
        eq(userEntitlements.resourceId, resourceId),
        lte(userEntitlements.startsAt, now()),
        or(isNull(userEntitlements.expiresAt), gt(userEntitlements.expiresAt, now())),
      ))
      .limit(1);
    return !!rows[0];
  },

  async findBySource(userId: string, source: string, sourceId: string, key?: string) {
    const sourceFilter = and(
      eq(userEntitlements.userId, userId),
      eq(userEntitlements.source, source),
      eq(userEntitlements.sourceId, sourceId),
      lte(userEntitlements.startsAt, now()),
      or(isNull(userEntitlements.expiresAt), gt(userEntitlements.expiresAt, now())),
      ...(key ? [eq(userEntitlements.key, key)] : []),
    );
    const rows = await db
      .select()
      .from(userEntitlements)
      .where(sourceFilter)
      .orderBy(desc(userEntitlements.createdAt))
      .limit(1);
    return rows[0] ?? null;
  },

  async findAnyBySource(userId: string, source: string, sourceId: string, key?: string) {
    const sourceFilter = and(
      eq(userEntitlements.userId, userId),
      eq(userEntitlements.source, source),
      eq(userEntitlements.sourceId, sourceId),
      ...(key ? [eq(userEntitlements.key, key)] : []),
    );
    const rows = await db
      .select()
      .from(userEntitlements)
      .where(sourceFilter)
      .orderBy(desc(userEntitlements.createdAt))
      .limit(1);
    return rows[0] ?? null;
  },

  async extendMembershipBenefitEntitlements(userId: string, membershipId: string, expiresAt: Date) {
    await db
      .update(userEntitlements)
      .set({ expiresAt })
      .where(and(
        eq(userEntitlements.userId, userId),
        eq(userEntitlements.source, 'membership_benefit'),
        sql`${userEntitlements.sourceId} like ${`%:${membershipId}:%`}`,
        or(isNull(userEntitlements.expiresAt), lte(userEntitlements.expiresAt, expiresAt)),
      ));
  },
};

export const walletRepository = {
  async findAccount(userId: string, currency: WalletCurrency) {
    const rows = await db
      .select()
      .from(walletAccounts)
      .where(and(eq(walletAccounts.userId, userId), eq(walletAccounts.currency, currency)))
      .limit(1);
    return rows[0] ?? null;
  },

  async ensureAccount(userId: string, currency: WalletCurrency, initialBalance = 0) {
    const existing = await this.findAccount(userId, currency);
    if (existing) return existing;

    const id = walletAccountId(userId, currency);
    try {
      await db.insert(walletAccounts).values({
        id,
        userId,
        currency,
        balance: initialBalance,
      });
    } catch (error) {
      const concurrent = await this.findAccount(userId, currency);
      if (concurrent) return concurrent;
      throw error;
    }
    return this.findAccount(userId, currency);
  },

  async credit(data: {
    userId: string;
    currency: WalletCurrency;
    amount: number;
    source: string;
    sourceId?: string;
    description?: string;
    metadata?: JsonRecord;
  }) {
    if (data.amount <= 0) throw new Error('Credit amount must be positive');
    const account = await this.ensureAccount(data.userId, data.currency);
    if (!account) throw new Error('Wallet account unavailable');

    if (data.sourceId) {
      const id = walletTransactionId({
        userId: data.userId,
        currency: data.currency,
        direction: 'credit',
        source: data.source,
        sourceId: data.sourceId,
      });
      const currentAccount = await this.findAccount(data.userId, data.currency) || account;
      try {
        await db.insert(walletTransactions).values({
          id,
          accountId: account.id,
          userId: data.userId,
          currency: data.currency,
          direction: 'credit',
          amount: data.amount,
          balanceAfter: Number(currentAccount.balance || 0),
          source: data.source,
          sourceId: data.sourceId,
          description: data.description || '',
          metadata: data.metadata || {},
        });
      } catch {
        const existingRows = await db
          .select({ id: walletTransactions.id })
          .from(walletTransactions)
          .where(eq(walletTransactions.id, id))
          .limit(1);
        if (existingRows[0]) {
          const existingAccount = await this.findAccount(data.userId, data.currency);
          return { account: existingAccount, transactionId: existingRows[0].id, applied: false };
        }
        throw new Error('Wallet transaction insert failed');
      }

      const updated = await db
        .update(walletAccounts)
        .set({
          balance: sql`${walletAccounts.balance} + ${data.amount}`,
          updatedAt: now(),
        })
        .where(eq(walletAccounts.id, account.id))
        .returning({ balanceAfter: walletAccounts.balance });
      const balanceAfter = Number(updated[0]?.balanceAfter ?? Number(currentAccount.balance || 0) + data.amount);
      await db
        .update(walletTransactions)
        .set({ balanceAfter })
        .where(eq(walletTransactions.id, id));
      const updatedAccount = await this.findAccount(data.userId, data.currency);
      return { account: updatedAccount, transactionId: id, applied: true };
    }

    const updated = await db
      .update(walletAccounts)
      .set({
        balance: sql`${walletAccounts.balance} + ${data.amount}`,
        updatedAt: now(),
      })
      .where(eq(walletAccounts.id, account.id))
      .returning({ balanceAfter: walletAccounts.balance });
    const balanceAfter = Number(updated[0]?.balanceAfter ?? Number(account.balance || 0) + data.amount);

    const id = crypto.randomUUID();
    await db.insert(walletTransactions).values({
      id,
      accountId: account.id,
      userId: data.userId,
      currency: data.currency,
      direction: 'credit',
      amount: data.amount,
      balanceAfter,
      source: data.source,
      sourceId: data.sourceId,
      description: data.description || '',
      metadata: data.metadata || {},
    });
    const updatedAccount = await this.findAccount(data.userId, data.currency);
    return { account: updatedAccount, transactionId: id };
  },

  async debit(data: {
    userId: string;
    currency: WalletCurrency;
    amount: number;
    source: string;
    sourceId?: string;
    description?: string;
    metadata?: JsonRecord;
  }) {
    if (data.amount <= 0) throw new Error('Debit amount must be positive');
    const account = await this.ensureAccount(data.userId, data.currency);
    if (!account) throw new Error('Wallet account unavailable');

    if (data.sourceId) {
      const id = walletTransactionId({
        userId: data.userId,
        currency: data.currency,
        direction: 'debit',
        source: data.source,
        sourceId: data.sourceId,
      });
      const currentAccount = await this.findAccount(data.userId, data.currency) || account;
      try {
        await db.insert(walletTransactions).values({
          id,
          accountId: account.id,
          userId: data.userId,
          currency: data.currency,
          direction: 'debit',
          amount: data.amount,
          balanceAfter: Number(currentAccount.balance || 0),
          source: data.source,
          sourceId: data.sourceId,
          description: data.description || '',
          metadata: data.metadata || {},
        });
      } catch {
        const existingRows = await db
          .select({ id: walletTransactions.id })
          .from(walletTransactions)
          .where(eq(walletTransactions.id, id))
          .limit(1);
        if (existingRows[0]) {
          const existingAccount = await this.findAccount(data.userId, data.currency);
          return { ok: true as const, account: existingAccount, transactionId: existingRows[0].id, applied: false };
        }
        throw new Error('Wallet transaction insert failed');
      }

      const updated = await db
        .update(walletAccounts)
        .set({
          balance: sql`${walletAccounts.balance} - ${data.amount}`,
          updatedAt: now(),
        })
        .where(and(
          eq(walletAccounts.id, account.id),
          sql`${walletAccounts.balance} >= ${data.amount}`,
        ))
        .returning({ balanceAfter: walletAccounts.balance });
      const balanceAfter = updated[0]?.balanceAfter;
      if (balanceAfter === undefined || balanceAfter === null) {
        await db.delete(walletTransactions).where(eq(walletTransactions.id, id));
        const current = await this.findAccount(data.userId, data.currency);
        return { ok: false as const, account: current || account, transactionId: null, applied: false };
      }

      await db
        .update(walletTransactions)
        .set({ balanceAfter: Number(balanceAfter) })
        .where(eq(walletTransactions.id, id));
      const updatedAccount = await this.findAccount(data.userId, data.currency);
      return { ok: true as const, account: updatedAccount, transactionId: id, applied: true };
    }

    const updated = await db
      .update(walletAccounts)
      .set({
        balance: sql`${walletAccounts.balance} - ${data.amount}`,
        updatedAt: now(),
      })
      .where(and(
        eq(walletAccounts.id, account.id),
        sql`${walletAccounts.balance} >= ${data.amount}`,
      ))
      .returning({ balanceAfter: walletAccounts.balance });
    const balanceAfter = updated[0]?.balanceAfter;
    if (balanceAfter === undefined || balanceAfter === null) {
      const currentAccount = await this.findAccount(data.userId, data.currency);
      return { ok: false as const, account: currentAccount || account, transactionId: null };
    }

    const id = crypto.randomUUID();
    await db.insert(walletTransactions).values({
      id,
      accountId: account.id,
      userId: data.userId,
      currency: data.currency,
      direction: 'debit',
      amount: data.amount,
      balanceAfter: Number(balanceAfter),
      source: data.source,
      sourceId: data.sourceId,
      description: data.description || '',
      metadata: data.metadata || {},
    });
    const updatedAccount = await this.findAccount(data.userId, data.currency);
    return { ok: true as const, account: updatedAccount, transactionId: id };
  },

  async listAccounts(userId: string) {
    return db.select().from(walletAccounts).where(eq(walletAccounts.userId, userId));
  },

  async listTransactions(userId: string, limit = 50) {
    return db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.userId, userId))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(limit);
  },

  async sumCredits(userId: string, currency: WalletCurrency) {
    const rows = await db
      .select({ total: sql<number>`coalesce(sum(${walletTransactions.amount}), 0)` })
      .from(walletTransactions)
      .where(and(
        eq(walletTransactions.userId, userId),
        eq(walletTransactions.currency, currency),
        eq(walletTransactions.direction, 'credit'),
      ))
      .limit(1);
    return Number(rows[0]?.total || 0);
  },

  async hasTransaction(userId: string, source: string, sourceId: string) {
    const rows = await db
      .select({ id: walletTransactions.id })
      .from(walletTransactions)
      .where(and(
        eq(walletTransactions.userId, userId),
        eq(walletTransactions.source, source),
        eq(walletTransactions.sourceId, sourceId),
      ))
      .limit(1);
    return Boolean(rows[0]);
  },

};

export const orderRepository = {
  async create(data: {
    userId: string;
    products: Array<{ productId: string; quantity: number }>;
    source?: string;
    metadata?: JsonRecord;
  }) {
    const productRows = await productRepository.listByIds(data.products.map((item) => item.productId)) as ProductRecord[];
    const byId = new Map<string, ProductRecord>(productRows.map((product: ProductRecord) => [product.id, product]));
    const normalized = data.products.map((item) => {
      const product = byId.get(item.productId);
      if (!product || !product.active) throw new Error(`Product not found or inactive: ${item.productId}`);
      const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
      return { product, quantity };
    });

    const totalCents = normalized.reduce((sum, item) => sum + Number(item.product.priceCents || 0) * item.quantity, 0);
    const id = crypto.randomUUID();
    await db.insert(orders).values({
      id,
      userId: data.userId,
      orderNo: orderNo(),
      status: 'pending_payment',
      totalCents,
      payableCents: totalCents,
      currency: normalized[0]?.product.currency || 'CNY',
      source: data.source || 'web',
      metadata: data.metadata || {},
    });

    await db.insert(orderItems).values(normalized.map((item) => ({
      id: crypto.randomUUID(),
      orderId: id,
      productId: item.product.id,
      productType: item.product.type,
      resourceType: item.product.resourceType,
      resourceId: item.product.resourceId,
      name: item.product.name,
      quantity: item.quantity,
      unitPriceCents: item.product.priceCents,
      totalCents: Number(item.product.priceCents || 0) * item.quantity,
      metadata: item.product.metadata || {},
    })));

    return this.findByIdForUser(id, data.userId);
  },

  async listForUser(userId: string, limit = 50): Promise<OrderRecord[]> {
    return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt)).limit(limit);
  },

  async listForUserDetailed(userId: string, limit = 50): Promise<DetailedOrderRecord[]> {
    const rows = await this.listForUser(userId, limit);
    return Promise.all(rows.map(async (order) => ({
      ...order,
      items: await db.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
      payments: await db.select().from(payments).where(eq(payments.orderId, order.id)).orderBy(desc(payments.createdAt)),
    })));
  },

  async listAll(limit = 100, status?: string): Promise<OrderRecord[]> {
    if (status) {
      return db
        .select()
        .from(orders)
        .where(eq(orders.status, status))
        .orderBy(desc(orders.createdAt))
        .limit(limit);
    }
    return db.select().from(orders).orderBy(desc(orders.createdAt)).limit(limit);
  },

  async listAllDetailed(limit = 100, status?: string): Promise<DetailedOrderRecord[]> {
    const rows = await this.listAll(limit, status);
    return Promise.all(rows.map(async (order) => ({
      ...order,
      items: await db.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
      payments: await db.select().from(payments).where(eq(payments.orderId, order.id)).orderBy(desc(payments.createdAt)),
    })));
  },

  async findById(id: string) {
    const rows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async findByIdForUser(id: string, userId: string) {
    const order = await this.findById(id);
    if (!order || order.userId !== userId) return null;
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
    const paymentRows = await db.select().from(payments).where(eq(payments.orderId, id)).orderBy(desc(payments.createdAt));
    return { ...order, items, payments: paymentRows };
  },

  async markPaid(orderId: string, payment: {
    provider?: string;
    providerTradeNo?: string;
    rawPayload?: JsonRecord;
  }) {
    const order = await this.findById(orderId);
    if (!order) throw new Error('Order not found');
    if (order.status === 'paid' || order.status === 'fulfilling' || order.status === 'fulfilled') return order;
    if (order.status !== 'pending_payment') throw new Error('Only pending orders can be paid');

    const paidAt = now();
    const paidRows = await db
      .update(orders)
      .set({ status: 'paid', paidAt, updatedAt: paidAt })
      .where(and(eq(orders.id, orderId), eq(orders.status, 'pending_payment')))
      .returning({
        id: orders.id,
        payableCents: orders.payableCents,
        currency: orders.currency,
      });
    const paidOrder = paidRows[0];
    if (!paidOrder) return this.findById(orderId);

    await db.insert(payments).values({
      id: crypto.randomUUID(),
      orderId,
      provider: payment.provider || 'mock',
      providerTradeNo: payment.providerTradeNo || `mock_${crypto.randomUUID()}`,
      status: 'succeeded',
      amountCents: paidOrder.payableCents,
      currency: paidOrder.currency,
      rawPayload: payment.rawPayload || {},
      paidAt,
    });
    return this.findById(orderId);
  },

  async markFulfilled(orderId: string) {
    await db
      .update(orders)
      .set({ status: 'fulfilled', fulfilledAt: now(), updatedAt: now() })
      .where(and(eq(orders.id, orderId), eq(orders.status, 'fulfilling')));
    return this.findById(orderId);
  },

  async startFulfillment(orderId: string) {
    const startedAt = now();
    const rows = await db
      .update(orders)
      .set({ status: 'fulfilling', updatedAt: startedAt })
      .where(and(eq(orders.id, orderId), eq(orders.status, 'paid')))
      .returning({ id: orders.id });
    return Boolean(rows[0]);
  },

  async markFulfillmentFailed(orderId: string, metadata?: JsonRecord) {
    const order = await this.findById(orderId);
    if (!order || order.status !== 'fulfilling') return order;
    await db
      .update(orders)
      .set({
        status: 'paid',
        metadata: { ...jsonRecord(order.metadata), ...(metadata || {}) },
        updatedAt: now(),
      })
      .where(and(eq(orders.id, orderId), eq(orders.status, 'fulfilling')));
    return this.findById(orderId);
  },

  async markCanceled(orderId: string, metadata?: JsonRecord) {
    const order = await this.findById(orderId);
    if (!order) throw new Error('Order not found');
    if (order.status !== 'pending_payment') throw new Error('只有待支付订单可以取消');

    await db
      .update(orders)
      .set({
        status: 'canceled',
        metadata: { ...jsonRecord(order.metadata), ...(metadata || {}) },
        updatedAt: now(),
      })
      .where(eq(orders.id, orderId));
    return this.findById(orderId);
  },

  async listItems(orderId: string) {
    return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  },
};

export const notificationStoreRepository = {
  async create(data: {
    userId: string;
    type: string;
    title: string;
    description?: string;
    actionUrl?: string;
    metadata?: JsonRecord;
  }) {
    const id = crypto.randomUUID();
    await db.insert(notifications).values({
      id,
      userId: data.userId,
      type: data.type,
      title: data.title,
      description: data.description || '',
      actionUrl: data.actionUrl,
      metadata: data.metadata || {},
    });
    return id;
  },

  async listForUser(userId: string, limit = 50) {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  },

  async markRead(userId: string, ids?: string[]) {
    const filter = ids?.length
      ? and(eq(notifications.userId, userId), inArray(notifications.id, ids))
      : eq(notifications.userId, userId);
    await db
      .update(notifications)
      .set({ status: 'read', readAt: now() })
      .where(filter);
  },

  async hasSource(userId: string, type: string, sourceId: string) {
    const rows = await db
      .select({ metadata: notifications.metadata })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.type, type)));
    return rows.some((row: { metadata: unknown }) => {
      const metadata = jsonRecord(row.metadata);
      return metadata.sourceId === sourceId || metadata.orderId === sourceId;
    });
  },
};

export const redeemCodeRepository = {
  async upsert(data: {
    code: string;
    type?: string;
    status?: string;
    maxClaims?: number;
    benefit: JsonRecord;
    startsAt?: Date | null;
    expiresAt?: Date | null;
  }) {
    const normalizedCode = data.code.trim().toUpperCase();
    const existing = await this.findByCode(normalizedCode);
    if (existing) {
      await db
        .update(redeemCodes)
        .set({
          type: data.type || existing.type,
          status: data.status || existing.status,
          maxClaims: data.maxClaims ?? existing.maxClaims,
          benefit: data.benefit,
          startsAt: data.startsAt ?? existing.startsAt,
          expiresAt: data.expiresAt ?? existing.expiresAt,
          updatedAt: now(),
        })
        .where(eq(redeemCodes.id, existing.id));
      return this.findByCode(normalizedCode);
    }

    const id = crypto.randomUUID();
    await db.insert(redeemCodes).values({
      id,
      code: normalizedCode,
      type: data.type || 'benefit',
      status: data.status || 'active',
      maxClaims: data.maxClaims ?? 1,
      benefit: data.benefit,
      startsAt: data.startsAt || null,
      expiresAt: data.expiresAt || null,
    });
    return this.findByCode(normalizedCode);
  },

  async findByCode(code: string) {
    const rows = await db
      .select()
      .from(redeemCodes)
      .where(eq(redeemCodes.code, code.trim().toUpperCase()))
      .limit(1);
    return rows[0] ?? null;
  },

  async hasClaimed(redeemCodeId: string, userId: string) {
    const rows = await db
      .select({ id: redeemCodeClaims.id })
      .from(redeemCodeClaims)
      .where(and(
        eq(redeemCodeClaims.redeemCodeId, redeemCodeId),
        eq(redeemCodeClaims.userId, userId),
        eq(redeemCodeClaims.status, 'success'),
      ))
      .limit(1);
    return Boolean(rows[0]);
  },

  async findClaim(redeemCodeId: string, userId: string) {
    const rows = await db
      .select()
      .from(redeemCodeClaims)
      .where(and(
        eq(redeemCodeClaims.redeemCodeId, redeemCodeId),
        eq(redeemCodeClaims.userId, userId),
        eq(redeemCodeClaims.status, 'success'),
      ))
      .limit(1);
    return rows[0] ?? null;
  },

  async findAnyClaim(redeemCodeId: string, userId: string) {
    const rows = await db
      .select()
      .from(redeemCodeClaims)
      .where(and(
        eq(redeemCodeClaims.redeemCodeId, redeemCodeId),
        eq(redeemCodeClaims.userId, userId),
      ))
      .limit(1);
    return rows[0] ?? null;
  },

  async createClaim(data: {
    redeemCodeId: string;
    userId: string;
    metadata?: JsonRecord;
  }) {
    const id = `redeem:${data.redeemCodeId}:${data.userId}`;
    const existing = await this.findClaim(data.redeemCodeId, data.userId);
    if (existing) {
      return { status: 'already_claimed' as const, id: existing.id };
    }
    const existingClaim = await this.findAnyClaim(data.redeemCodeId, data.userId);

    const reserved = await db
      .update(redeemCodes)
      .set({
        claimedCount: sql`${redeemCodes.claimedCount} + 1`,
        updatedAt: now(),
      })
      .where(and(
        eq(redeemCodes.id, data.redeemCodeId),
        sql`${redeemCodes.claimedCount} < ${redeemCodes.maxClaims}`,
      ))
      .returning({ id: redeemCodes.id });
    if (!reserved[0]) {
      return { status: 'out_of_stock' as const, id: null };
    }

    if (existingClaim) {
      const updated = await db
        .update(redeemCodeClaims)
        .set({
          status: 'success',
          metadata: data.metadata || {},
        })
        .where(and(
          eq(redeemCodeClaims.id, id),
          eq(redeemCodeClaims.status, 'failed'),
        ))
        .returning({ id: redeemCodeClaims.id });
      if (updated[0]) return { status: 'created' as const, id: updated[0].id };

      await db
        .update(redeemCodes)
        .set({
          claimedCount: sql`max(${redeemCodes.claimedCount} - 1, 0)`,
          updatedAt: now(),
        })
        .where(eq(redeemCodes.id, data.redeemCodeId));
      const claimed = await this.findClaim(data.redeemCodeId, data.userId);
      if (claimed) return { status: 'already_claimed' as const, id: claimed.id };
      throw new Error('兑换码领取状态已变化，请重试');
    }

    try {
      await db.insert(redeemCodeClaims).values({
        id,
        redeemCodeId: data.redeemCodeId,
        userId: data.userId,
        status: 'success',
        metadata: data.metadata || {},
      });
      return { status: 'created' as const, id };
    } catch (error) {
      await db
        .update(redeemCodes)
        .set({
          claimedCount: sql`max(${redeemCodes.claimedCount} - 1, 0)`,
          updatedAt: now(),
        })
        .where(eq(redeemCodes.id, data.redeemCodeId));
      const claimed = await this.findClaim(data.redeemCodeId, data.userId);
      if (claimed) return { status: 'already_claimed' as const, id: claimed.id };
      throw error;
    }
  },

  async markClaimFailed(redeemCodeId: string, userId: string, metadata?: JsonRecord) {
    const id = `redeem:${redeemCodeId}:${userId}`;
    const claim = await this.findClaim(redeemCodeId, userId);
    if (!claim) return null;
    const updated = await db
      .update(redeemCodeClaims)
      .set({
        status: 'failed',
        metadata: { ...jsonRecord(claim.metadata), ...(metadata || {}) },
      })
      .where(and(
        eq(redeemCodeClaims.id, id),
        eq(redeemCodeClaims.status, 'success'),
      ))
      .returning({ id: redeemCodeClaims.id });
    if (!updated[0]) return null;
    await db
      .update(redeemCodes)
      .set({
        claimedCount: sql`max(${redeemCodes.claimedCount} - 1, 0)`,
        updatedAt: now(),
      })
      .where(eq(redeemCodes.id, redeemCodeId));
    return id;
  },

  async list(limit = 100) {
    return db.select().from(redeemCodes).orderBy(desc(redeemCodes.updatedAt)).limit(limit);
  },
};

export const aiUsageRepository = {
  async findById(id: string) {
    const rows = await db.select().from(aiUsageLogs).where(eq(aiUsageLogs.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async record(data: {
    userId: string;
    feature: string;
    provider?: string;
    model?: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    creditsCharged?: number;
    walletTransactionId?: string | null;
    status?: string;
    error?: string | null;
    metadata?: JsonRecord;
  }) {
    const id = crypto.randomUUID();
    await db.insert(aiUsageLogs).values({
      id,
      userId: data.userId,
      feature: data.feature,
      provider: data.provider,
      model: data.model,
      promptTokens: data.promptTokens || 0,
      completionTokens: data.completionTokens || 0,
      totalTokens: data.totalTokens || 0,
      creditsCharged: data.creditsCharged || 0,
      walletTransactionId: data.walletTransactionId || null,
      status: data.status || 'success',
      error: data.error || null,
      metadata: data.metadata || {},
    });
    return id;
  },

  async update(id: string, data: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    creditsCharged?: number;
    walletTransactionId?: string | null;
    status?: string;
    error?: string | null;
    metadata?: JsonRecord;
  }) {
    await db
      .update(aiUsageLogs)
      .set({
        ...(data.promptTokens !== undefined ? { promptTokens: data.promptTokens } : {}),
        ...(data.completionTokens !== undefined ? { completionTokens: data.completionTokens } : {}),
        ...(data.totalTokens !== undefined ? { totalTokens: data.totalTokens } : {}),
        ...(data.creditsCharged !== undefined ? { creditsCharged: data.creditsCharged } : {}),
        ...(data.walletTransactionId !== undefined ? { walletTransactionId: data.walletTransactionId } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.error !== undefined ? { error: data.error } : {}),
        ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
      })
      .where(eq(aiUsageLogs.id, id));
    return this.findById(id);
  },

  async listForUser(userId: string, limit = 50) {
    return db
      .select()
      .from(aiUsageLogs)
      .where(eq(aiUsageLogs.userId, userId))
      .orderBy(desc(aiUsageLogs.createdAt))
      .limit(limit);
  },
};

export const interviewQuestionBankRepository = {
  async list(activeOnly = true) {
    if (activeOnly) {
      return db
        .select()
        .from(interviewQuestionBanks)
        .where(eq(interviewQuestionBanks.active, true))
        .orderBy(desc(interviewQuestionBanks.updatedAt));
    }
    return db.select().from(interviewQuestionBanks).orderBy(desc(interviewQuestionBanks.updatedAt));
  },

  async findByKey(key: string) {
    const rows = await db.select().from(interviewQuestionBanks).where(eq(interviewQuestionBanks.key, key)).limit(1);
    return rows[0] ?? null;
  },

  async findById(id: string) {
    const rows = await db.select().from(interviewQuestionBanks).where(eq(interviewQuestionBanks.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async upsertBank(data: {
    key: string;
    title: string;
    description: string;
    industry: string;
    role: string;
    level: string;
    companyType: string;
    accessLevel: string;
    metadata?: JsonRecord;
  }) {
    const existing = await this.findByKey(data.key);
    if (existing) {
      await db
        .update(interviewQuestionBanks)
        .set({ ...data, active: true, updatedAt: now() })
        .where(eq(interviewQuestionBanks.id, existing.id));
      return this.findByKey(data.key);
    }
    const id = crypto.randomUUID();
    await db.insert(interviewQuestionBanks).values({ id, ...data, metadata: data.metadata || {} });
    return this.findByKey(data.key);
  },

  async upsertSeedQuestions(bankId: string, items: Array<{
    dimension: string;
    difficulty: string;
    questionType: string;
    prompt: string;
    referenceAnswer: string;
    rubric: JsonRecord;
    keywords: string[];
    followUpStrategy: JsonRecord;
    metadata?: JsonRecord;
  }>) {
    const existingQuestions = await this.listQuestions(bankId) as InterviewQuestionRecord[];
    const existingByPrompt = new Map(existingQuestions.map((question) => [question.prompt, question]));

    for (const item of items) {
      const existing = existingByPrompt.get(item.prompt);
      const values = {
        bankId,
        dimension: item.dimension,
        difficulty: item.difficulty,
        questionType: item.questionType,
        prompt: item.prompt,
        referenceAnswer: item.referenceAnswer,
        rubric: item.rubric,
        keywords: item.keywords,
        followUpStrategy: item.followUpStrategy,
        metadata: item.metadata || {},
        updatedAt: now(),
      };

      if (existing) {
        await db
          .update(interviewQuestions)
          .set(values)
          .where(eq(interviewQuestions.id, existing.id));
      } else {
        await db.insert(interviewQuestions).values({
          id: crypto.randomUUID(),
          ...values,
        });
      }
    }
  },

  async listQuestions(bankId: string) {
    return db.select().from(interviewQuestions).where(eq(interviewQuestions.bankId, bankId));
  },

  async findQuestionById(questionId: string) {
    const rows = await db.select().from(interviewQuestions).where(eq(interviewQuestions.id, questionId)).limit(1);
    return rows[0] ?? null;
  },

  async findQuestionInBank(bankId: string, questionId: string) {
    const rows = await db
      .select()
      .from(interviewQuestions)
      .where(and(eq(interviewQuestions.bankId, bankId), eq(interviewQuestions.id, questionId)))
      .limit(1);
    return rows[0] ?? null;
  },
};

export const interviewQuestionPracticeRepository = {
  async listFavorites(userId: string, bankId?: string) {
    const conditions = bankId
      ? and(eq(interviewQuestionFavorites.userId, userId), eq(interviewQuestionFavorites.bankId, bankId))
      : eq(interviewQuestionFavorites.userId, userId);
    return db
      .select()
      .from(interviewQuestionFavorites)
      .where(conditions)
      .orderBy(desc(interviewQuestionFavorites.createdAt));
  },

  async isFavorite(userId: string, questionId: string) {
    const rows = await db
      .select({ id: interviewQuestionFavorites.id })
      .from(interviewQuestionFavorites)
      .where(and(eq(interviewQuestionFavorites.userId, userId), eq(interviewQuestionFavorites.questionId, questionId)))
      .limit(1);
    return Boolean(rows[0]);
  },

  async setFavorite(data: {
    userId: string;
    bankId: string;
    questionId: string;
    favorite: boolean;
    source?: string;
    metadata?: JsonRecord;
  }) {
    if (!data.favorite) {
      await db
        .delete(interviewQuestionFavorites)
        .where(and(
          eq(interviewQuestionFavorites.userId, data.userId),
          eq(interviewQuestionFavorites.questionId, data.questionId),
        ));
      return { favorite: false };
    }

    const existing = await this.isFavorite(data.userId, data.questionId);
    if (!existing) {
      await db.insert(interviewQuestionFavorites).values({
        id: crypto.randomUUID(),
        userId: data.userId,
        bankId: data.bankId,
        questionId: data.questionId,
        source: data.source || 'manual',
        metadata: data.metadata || {},
      });
    }
    return { favorite: true };
  },

  async findStats(userId: string, questionId: string) {
    const rows = await db
      .select()
      .from(interviewQuestionStats)
      .where(and(eq(interviewQuestionStats.userId, userId), eq(interviewQuestionStats.questionId, questionId)))
      .orderBy(desc(interviewQuestionStats.updatedAt))
      .limit(1);
    return rows[0] ?? null;
  },

  async listStatsForBank(userId: string, bankId: string) {
    return db
      .select()
      .from(interviewQuestionStats)
      .where(and(eq(interviewQuestionStats.userId, userId), eq(interviewQuestionStats.bankId, bankId)))
      .orderBy(desc(interviewQuestionStats.updatedAt));
  },

  async recordAttempt(data: {
    userId: string;
    bankId: string;
    questionId: string;
    answer: string;
    score: number;
    maxScore?: number;
    isCorrect: boolean;
    feedback?: string;
    rubricResult?: JsonRecord;
    metadata?: JsonRecord;
  }) {
    const attemptId = crypto.randomUUID();
    const normalizedScore = Math.max(0, Math.min(100, Math.round(Number(data.score || 0))));
    await db.insert(interviewQuestionPracticeAttempts).values({
      id: attemptId,
      userId: data.userId,
      bankId: data.bankId,
      questionId: data.questionId,
      answer: data.answer,
      score: normalizedScore,
      maxScore: data.maxScore || 100,
      isCorrect: data.isCorrect,
      feedback: data.feedback || '',
      rubricResult: data.rubricResult || {},
      metadata: data.metadata || {},
    });

    const existing = await this.findStats(data.userId, data.questionId);
    if (existing) {
      const attemptCount = Number(existing.attemptCount || 0) + 1;
      const correctCount = Number(existing.correctCount || 0) + (data.isCorrect ? 1 : 0);
      const wrongCount = Number(existing.wrongCount || 0) + (data.isCorrect ? 0 : 1);
      const bestScore = Math.max(Number(existing.bestScore || 0), normalizedScore);
      await db
        .update(interviewQuestionStats)
        .set({
          attemptCount,
          correctCount,
          wrongCount,
          bestScore,
          lastScore: normalizedScore,
          mastered: bestScore >= 85 && correctCount >= 2,
          lastAttemptAt: now(),
          updatedAt: now(),
        })
        .where(eq(interviewQuestionStats.id, existing.id));
    } else {
      await db.insert(interviewQuestionStats).values({
        id: crypto.randomUUID(),
        userId: data.userId,
        bankId: data.bankId,
        questionId: data.questionId,
        attemptCount: 1,
        correctCount: data.isCorrect ? 1 : 0,
        wrongCount: data.isCorrect ? 0 : 1,
        bestScore: normalizedScore,
        lastScore: normalizedScore,
        mastered: normalizedScore >= 85 && data.isCorrect,
        lastAttemptAt: now(),
      });
    }

    return {
      attempt: await this.findAttemptById(attemptId),
      stats: await this.findStats(data.userId, data.questionId),
    };
  },

  async findAttemptById(id: string) {
    const rows = await db.select().from(interviewQuestionPracticeAttempts).where(eq(interviewQuestionPracticeAttempts.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async listAttemptsForUser(userId: string, limit = 50) {
    return db
      .select()
      .from(interviewQuestionPracticeAttempts)
      .where(eq(interviewQuestionPracticeAttempts.userId, userId))
      .orderBy(desc(interviewQuestionPracticeAttempts.createdAt))
      .limit(limit);
  },

  async listAttemptsForUserAndBank(userId: string, bankId: string, limit = 50) {
    return db
      .select()
      .from(interviewQuestionPracticeAttempts)
      .where(and(
        eq(interviewQuestionPracticeAttempts.userId, userId),
        eq(interviewQuestionPracticeAttempts.bankId, bankId),
      ))
      .orderBy(desc(interviewQuestionPracticeAttempts.createdAt))
      .limit(limit);
  },

  async listWrongStats(userId: string, limit = 50) {
    return db
      .select()
      .from(interviewQuestionStats)
      .where(and(eq(interviewQuestionStats.userId, userId), gt(interviewQuestionStats.wrongCount, 0)))
      .orderBy(desc(interviewQuestionStats.updatedAt))
      .limit(limit);
  },
};

export const referralRepository = {
  async listAll(limit = 100) {
    return db.select().from(referralRelations).orderBy(desc(referralRelations.createdAt)).limit(limit);
  },

  async listForInviter(inviterUserId: string, limit = 50) {
    return db
      .select()
      .from(referralRelations)
      .where(eq(referralRelations.inviterUserId, inviterUserId))
      .orderBy(desc(referralRelations.createdAt))
      .limit(limit);
  },

  async listForInvitee(inviteeUserId: string, limit = 50) {
    return db
      .select()
      .from(referralRelations)
      .where(eq(referralRelations.inviteeUserId, inviteeUserId))
      .orderBy(desc(referralRelations.createdAt))
      .limit(limit);
  },

  async findRelation(inviterUserId: string, inviteeUserId: string, campaignKey = 'default') {
    const rows = await db
      .select()
      .from(referralRelations)
      .where(and(
        eq(referralRelations.inviterUserId, inviterUserId),
        eq(referralRelations.inviteeUserId, inviteeUserId),
        eq(referralRelations.campaignKey, campaignKey),
      ))
      .limit(1);
    return rows[0] ?? null;
  },

  async createRelation(data: {
    inviterUserId: string;
    inviteeUserId: string;
    campaignKey?: string;
    status?: string;
    rewardStatus?: string;
    metadata?: JsonRecord;
  }) {
    const existingInviteeRelation = await this.listForInvitee(data.inviteeUserId, 1);
    if (existingInviteeRelation[0]) return existingInviteeRelation[0];

    const existing = await this.findRelation(data.inviterUserId, data.inviteeUserId, data.campaignKey || 'default');
    if (existing) return existing;

    const id = crypto.randomUUID();
    await db.insert(referralRelations).values({
      id,
      inviterUserId: data.inviterUserId,
      inviteeUserId: data.inviteeUserId,
      campaignKey: data.campaignKey || 'default',
      status: data.status || 'activated',
      rewardStatus: data.rewardStatus || 'granted',
      metadata: data.metadata || {},
    });
    return this.findRelation(data.inviterUserId, data.inviteeUserId, data.campaignKey || 'default');
  },
};

export const lotteryRepository = {
  async upsertCampaign(data: {
    key: string;
    title: string;
    status?: string;
    rules?: JsonRecord;
    startsAt?: Date | null;
    endsAt?: Date | null;
  }) {
    const existing = await this.findCampaignByKey(data.key);
    if (existing) {
      await db
        .update(lotteryCampaigns)
        .set({
          title: data.title,
          status: data.status || existing.status,
          rules: data.rules || existing.rules || {},
          startsAt: data.startsAt ?? existing.startsAt,
          endsAt: data.endsAt ?? existing.endsAt,
          updatedAt: now(),
        })
        .where(eq(lotteryCampaigns.id, existing.id));
      return this.findCampaignByKey(data.key);
    }

    const id = crypto.randomUUID();
    await db.insert(lotteryCampaigns).values({
      id,
      key: data.key,
      title: data.title,
      status: data.status || 'active',
      rules: data.rules || {},
      startsAt: data.startsAt || null,
      endsAt: data.endsAt || null,
    });
    return this.findCampaignByKey(data.key);
  },

  async findCampaignByKey(key: string) {
    const rows = await db.select().from(lotteryCampaigns).where(eq(lotteryCampaigns.key, key)).limit(1);
    return rows[0] ?? null;
  },

  async listCampaigns(activeOnly = true) {
    if (activeOnly) {
      return db
        .select()
        .from(lotteryCampaigns)
        .where(eq(lotteryCampaigns.status, 'active'))
        .orderBy(desc(lotteryCampaigns.updatedAt));
    }
    return db.select().from(lotteryCampaigns).orderBy(desc(lotteryCampaigns.updatedAt));
  },

  async createDraw(data: {
    id?: string;
    campaignId: string;
    userId: string;
    prizeType: string;
    prizePayload?: JsonRecord;
    status?: string;
  }) {
    const id = data.id || crypto.randomUUID();
    await db.insert(lotteryDraws).values({
      id,
      campaignId: data.campaignId,
      userId: data.userId,
      prizeType: data.prizeType,
      prizePayload: data.prizePayload || {},
      status: data.status || 'completed',
    });
    return this.findDrawById(id);
  },

  async findDrawById(id: string) {
    const rows = await db.select().from(lotteryDraws).where(eq(lotteryDraws.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async updateDraw(id: string, data: {
    prizeType?: string;
    prizePayload?: JsonRecord;
    status?: string;
  }) {
    await db
      .update(lotteryDraws)
      .set({
        ...(data.prizeType !== undefined ? { prizeType: data.prizeType } : {}),
        ...(data.prizePayload !== undefined ? { prizePayload: data.prizePayload } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      })
      .where(eq(lotteryDraws.id, id));
    return this.findDrawById(id);
  },

  async listDrawsForUser(userId: string, limit = 50) {
    return db
      .select()
      .from(lotteryDraws)
      .where(eq(lotteryDraws.userId, userId))
      .orderBy(desc(lotteryDraws.createdAt))
      .limit(limit);
  },

  async listDraws(limit = 100) {
    return db.select().from(lotteryDraws).orderBy(desc(lotteryDraws.createdAt)).limit(limit);
  },
};

export async function syncLegacyAICredits(userId: string, balance: number) {
  await db.update(users).set({ aiCredits: Math.max(0, balance), updatedAt: now() }).where(eq(users.id, userId));
}
