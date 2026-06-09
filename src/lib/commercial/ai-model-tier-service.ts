import { getUserEntitlementProfile } from './entitlement-service';

export type AIModelTier = 'basic' | 'standard' | 'advanced' | 'business';

const TIER_RANK: Record<AIModelTier, number> = {
  basic: 0,
  standard: 10,
  advanced: 20,
  business: 30,
};

const MODEL_TIER_RULES: Array<{ pattern: RegExp; tier: AIModelTier }> = [
  { pattern: /\b(o1|o3|o4|gpt-5|opus|sonnet-4|gemini-3|pro|ultra)\b/i, tier: 'advanced' },
  { pattern: /\b(gpt-4|claude|sonnet|gemini-2|gemini-1\.5|flash)\b/i, tier: 'standard' },
  { pattern: /\b(mini|haiku|lite|small|nano)\b/i, tier: 'basic' },
];

function normalizeTier(value: unknown): AIModelTier {
  if (value === 'business' || value === 'advanced' || value === 'standard' || value === 'basic') return value;
  return 'basic';
}

export function isAIModelTierAllowed(allowedTier: unknown, requiredTier: unknown): boolean {
  const allowed = normalizeTier(allowedTier);
  const required = normalizeTier(requiredTier);
  return TIER_RANK[allowed] >= TIER_RANK[required];
}

export function inferAIModelTier(model: string): AIModelTier {
  const normalized = model.trim();
  if (!normalized) return 'basic';

  for (const rule of MODEL_TIER_RULES) {
    if (rule.pattern.test(normalized)) return rule.tier;
  }
  return 'standard';
}

type ServerAIModelAccessInput = {
  userId: string;
  model: string;
  legacyAiCredits?: number;
};

export async function getServerAIModelAccess(input: ServerAIModelAccessInput) {
  const profile = await getUserEntitlementProfile(input.userId, input.legacyAiCredits || 0);
  const allowedTier = normalizeTier(profile.entitlements['ai.model_tier']);
  const requiredTier = inferAIModelTier(input.model);

  return {
    allowedTier,
    requiredTier,
    allowed: isAIModelTierAllowed(allowedTier, requiredTier),
  };
}

export async function assertServerAIModelAllowedForUser(input: ServerAIModelAccessInput) {
  const access = await getServerAIModelAccess(input);

  if (!access.allowed) {
    throw new Error(`当前会员仅支持 ${access.allowedTier} 模型等级，请升级会员后使用 ${access.requiredTier} 模型。`);
  }

  return access;
}
