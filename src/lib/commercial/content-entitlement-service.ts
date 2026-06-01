import {
  canEntitlementLevelAccess,
  getNumericEntitlement,
  getUserEntitlementProfile,
} from './entitlement-service';
import { ensureTemplateProduct, ensureJobTemplateProduct, ensureQuestionBankProduct } from './billing-service';
import {
  entitlementRepository,
  notificationStoreRepository,
} from '@/lib/db/repositories/commercial.repository';

export type CommercialResourceType =
  | 'resume_template'
  | 'job_template'
  | 'interview_question_bank';

type ProductLike = {
  id: string;
  priceCents: number;
  currency: string;
  resourceType: string | null;
  resourceId: string | null;
};

type MembershipLike = {
  membership?: {
    membership?: {
      id?: string;
      currentPeriodStart?: Date | number | string | null;
      currentPeriodEnd?: Date | number | string | null;
    } | null;
  } | null;
} | null;

function membershipPeriodKey(profile: MembershipLike) {
  const membership = profile?.membership?.membership;
  if (!membership?.id) return 'default';
  const start = membership.currentPeriodStart
    ? new Date(membership.currentPeriodStart).getTime()
    : 0;
  return `${membership.id}:${Number.isFinite(start) ? start : 0}`;
}

function membershipPeriodEnd(profile: MembershipLike) {
  const value = profile?.membership?.membership?.currentPeriodEnd;
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function monthlyFreeDownloadSourceId(resourceType: string, resourceId: string, periodKey: string) {
  return `monthly_free:${resourceType}:${resourceId}:${periodKey}`;
}

function planBenefitSourceId(resourceType: string, resourceId: string, periodKey: string) {
  return `plan_benefit:${resourceType}:${resourceId}:${periodKey}`;
}

function isMonthlyFreeDownload(item: {
  source: string;
  sourceId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
}) {
  return item.source === 'membership_benefit'
    && item.sourceId?.startsWith('monthly_free:')
    && Boolean(item.resourceType)
    && Boolean(item.resourceId);
}

function resourceTypeLabel(resourceType: CommercialResourceType) {
  if (resourceType === 'resume_template') return '简历模板';
  if (resourceType === 'job_template') return '职位模板';
  return '面试题库';
}

export function countMonthlyFreeDownloads(profile: {
  directEntitlements: Array<{
    source: string;
    sourceId?: string | null;
    resourceType?: string | null;
    resourceId?: string | null;
  }>;
}, periodKey?: string) {
  return profile.directEntitlements.filter((item) => {
    if (!isMonthlyFreeDownload(item)) return false;
    return periodKey ? item.sourceId?.endsWith(`:${periodKey}`) : true;
  }).length;
}

export async function getContentAccessState(input: {
  userId: string;
  resourceType: CommercialResourceType;
  resourceId: string;
  product: ProductLike | null;
  legacyAiCredits?: number;
  owner?: boolean;
  admin?: boolean;
  allowMonthlyFreeDownload?: boolean;
  accessLevel?: string;
}) {
  const profile = await getUserEntitlementProfile(input.userId, input.legacyAiCredits || 0);
  const directEntitled = await entitlementRepository.hasResource(input.userId, input.resourceType, input.resourceId);
  const planEntitled = input.resourceType === 'job_template'
    ? Boolean(profile.entitlements['job_template.download'])
    : input.resourceType === 'interview_question_bank'
      ? canEntitlementLevelAccess(
          profile.entitlements,
          'interview.question_bank.access_level',
          input.accessLevel || 'free',
        )
      : false;
  const owned = Boolean(input.owner || input.admin);
  const allowMonthlyFreeDownload = input.allowMonthlyFreeDownload ?? input.resourceType === 'resume_template';
  const limit = getNumericEntitlement(profile, 'template.free_download_count', 0);
  const periodKey = membershipPeriodKey(profile as MembershipLike);
  const used = countMonthlyFreeDownloads(profile, periodKey);
  const remaining = Math.max(0, limit - used);

  return {
    profile,
    entitled: owned || directEntitled || planEntitled,
    directEntitled,
    planEntitled,
    owned,
    freeDownloads: {
      limit,
      used,
      remaining,
      periodKey,
    },
    canUseMonthlyFreeDownload: allowMonthlyFreeDownload && !owned && !directEntitled && !planEntitled && remaining > 0,
    product: input.product,
  };
}

export async function grantMonthlyFreeDownload(input: {
  userId: string;
  resourceType: CommercialResourceType;
  resourceId: string;
  product?: ProductLike | null;
  name?: string;
  legacyAiCredits?: number;
}) {
  const state = await getContentAccessState({
    userId: input.userId,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    product: input.product || null,
    legacyAiCredits: input.legacyAiCredits,
  });

  if (state.entitled) {
    return { granted: false, state, entitlement: null };
  }
  if (!state.canUseMonthlyFreeDownload) {
    return { granted: false, state, entitlement: null };
  }

  const sourceId = monthlyFreeDownloadSourceId(
    input.resourceType,
    input.resourceId,
    membershipPeriodKey(state.profile as MembershipLike),
  );
  const expiresAt = membershipPeriodEnd(state.profile as MembershipLike);
  const existing = await entitlementRepository.findBySource(
    input.userId,
    'membership_benefit',
    sourceId,
    `${input.resourceType}.download`,
  );
  if (existing) {
    return {
      granted: false,
      entitlement: existing,
      state: {
        ...state,
        entitled: true,
        directEntitled: true,
      },
    };
  }

  const entitlement = await entitlementRepository.grant({
    userId: input.userId,
    key: `${input.resourceType}.download`,
    value: true,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    source: 'membership_benefit',
    sourceId,
    expiresAt,
  });

  if (!(await notificationStoreRepository.hasSource(input.userId, 'membership_benefit', sourceId))) {
    await notificationStoreRepository.create({
      userId: input.userId,
      type: 'membership_benefit',
      title: '会员福利已解锁',
      description: `${input.name || resourceTypeLabel(input.resourceType)} 已使用会员免费下载权益解锁。`,
      actionUrl: '/zh/account',
      metadata: {
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        sourceId,
        productId: input.product?.id,
        expiresAt: expiresAt?.toISOString() || null,
        freeDownloads: {
          limit: state.freeDownloads.limit,
          used: state.freeDownloads.used + 1,
          remaining: Math.max(0, state.freeDownloads.remaining - 1),
          periodKey: state.freeDownloads.periodKey,
        },
      },
    });
  }

  return {
    granted: true,
    entitlement,
    state: {
      ...state,
      entitled: true,
      directEntitled: true,
      freeDownloads: {
        ...state.freeDownloads,
        used: state.freeDownloads.used + 1,
        remaining: Math.max(0, state.freeDownloads.remaining - 1),
      },
    },
  };
}

export async function grantPlanDownloadEntitlement(input: {
  userId: string;
  resourceType: CommercialResourceType;
  resourceId: string;
  product?: ProductLike | null;
  name?: string;
  legacyAiCredits?: number;
}) {
  const state = await getContentAccessState({
    userId: input.userId,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    product: input.product || null,
    legacyAiCredits: input.legacyAiCredits,
  });

  if (state.directEntitled || state.owned) {
    return { granted: false, state, entitlement: null };
  }
  if (!state.planEntitled) {
    return { granted: false, state, entitlement: null };
  }

  const sourceId = planBenefitSourceId(
    input.resourceType,
    input.resourceId,
    membershipPeriodKey(state.profile as MembershipLike),
  );
  const expiresAt = membershipPeriodEnd(state.profile as MembershipLike);
  const existing = await entitlementRepository.findBySource(
    input.userId,
    'membership_benefit',
    sourceId,
    `${input.resourceType}.download`,
  );
  if (existing) {
    return {
      granted: false,
      entitlement: existing,
      state: {
        ...state,
        entitled: true,
        directEntitled: true,
      },
    };
  }

  const entitlement = await entitlementRepository.grant({
    userId: input.userId,
    key: `${input.resourceType}.download`,
    value: true,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    source: 'membership_benefit',
    sourceId,
    expiresAt,
  });

  if (!(await notificationStoreRepository.hasSource(input.userId, 'membership_benefit', sourceId))) {
    await notificationStoreRepository.create({
      userId: input.userId,
      type: 'membership_benefit',
      title: '会员权益已记录',
      description: `${input.name || resourceTypeLabel(input.resourceType)} 已按会员权益解锁。`,
      actionUrl: '/zh/account',
      metadata: {
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        sourceId,
        productId: input.product?.id,
        benefitType: 'plan_download',
        expiresAt: expiresAt?.toISOString() || null,
      },
    });
  }

  return {
    granted: true,
    entitlement,
    state: {
      ...state,
      entitled: true,
      directEntitled: true,
    },
  };
}

export async function grantPlanQuestionBankEntitlement(input: {
  userId: string;
  bankId: string;
  accessLevel: string;
  product?: ProductLike | null;
  title?: string;
  legacyAiCredits?: number;
}) {
  const product = input.product || null;
  const profile = await getUserEntitlementProfile(input.userId, input.legacyAiCredits || 0);
  const directEntitled = await entitlementRepository.hasResource(
    input.userId,
    'interview_question_bank',
    input.bankId,
  );
  if (directEntitled) {
    return { granted: false, entitlement: null, entitled: true };
  }

  if (!canEntitlementLevelAccess(
    profile.entitlements,
    'interview.question_bank.access_level',
    input.accessLevel,
  )) {
    return { granted: false, entitlement: null, entitled: false };
  }

  const sourceId = planBenefitSourceId(
    'interview_question_bank',
    input.bankId,
    membershipPeriodKey(profile as MembershipLike),
  );
  const expiresAt = membershipPeriodEnd(profile as MembershipLike);
  const existing = await entitlementRepository.findBySource(
    input.userId,
    'membership_benefit',
    sourceId,
    'interview_question_bank.download',
  );
  if (existing) {
    return { granted: false, entitlement: existing, entitled: true };
  }

  const entitlement = await entitlementRepository.grant({
    userId: input.userId,
    key: 'interview_question_bank.download',
    value: true,
    resourceType: 'interview_question_bank',
    resourceId: input.bankId,
    source: 'membership_benefit',
    sourceId,
    expiresAt,
  });

  if (!(await notificationStoreRepository.hasSource(input.userId, 'membership_benefit', sourceId))) {
    await notificationStoreRepository.create({
      userId: input.userId,
      type: 'membership_benefit',
      title: '题库权限已记录',
      description: `${input.title || resourceTypeLabel('interview_question_bank')} 已按会员等级解锁。`,
      actionUrl: '/zh/account',
      metadata: {
        resourceType: 'interview_question_bank',
        resourceId: input.bankId,
        sourceId,
        productId: product?.id,
        benefitType: 'plan_question_bank',
        accessLevel: input.accessLevel,
        expiresAt: expiresAt?.toISOString() || null,
      },
    });
  }

  return { granted: true, entitlement, entitled: true };
}

export async function ensureResumeTemplateAccessPayload(input: {
  userId: string;
  templateId: string;
  name: string;
  description?: string;
  owner?: boolean;
  admin?: boolean;
  legacyAiCredits?: number;
}) {
  const product = await ensureTemplateProduct({
    templateId: input.templateId,
    name: input.name,
    description: input.description,
  });
  const access = await getContentAccessState({
    userId: input.userId,
    resourceType: 'resume_template',
    resourceId: input.templateId,
    product,
    legacyAiCredits: input.legacyAiCredits,
    owner: input.owner,
    admin: input.admin,
  });
  return { product, access };
}

export async function ensureJobTemplateAccessPayload(input: {
  userId: string;
  jobTemplateId: string;
  name: string;
  description?: string;
  owner?: boolean;
  admin?: boolean;
  legacyAiCredits?: number;
}) {
  const product = await ensureJobTemplateProduct({
    jobTemplateId: input.jobTemplateId,
    name: input.name,
    description: input.description,
  });
  const access = await getContentAccessState({
    userId: input.userId,
    resourceType: 'job_template',
    resourceId: input.jobTemplateId,
    product,
    legacyAiCredits: input.legacyAiCredits,
    owner: input.owner,
    admin: input.admin,
  });
  return { product, access };
}

export async function ensureQuestionBankAccessPayload(input: {
  userId: string;
  bankId: string;
  bankKey: string;
  title: string;
  description?: string;
  accessLevel: string;
  legacyAiCredits?: number;
}) {
  const product = await ensureQuestionBankProduct({
    bankId: input.bankId,
    bankKey: input.bankKey,
    title: input.title,
    description: input.description,
    accessLevel: input.accessLevel,
  });
  const access = await getContentAccessState({
    userId: input.userId,
    resourceType: 'interview_question_bank',
    resourceId: input.bankId,
    product,
    legacyAiCredits: input.legacyAiCredits,
    allowMonthlyFreeDownload: false,
    accessLevel: input.accessLevel,
  });
  return { product, access };
}
