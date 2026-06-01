import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import { getNumericEntitlement, getUserEntitlementProfile } from './entitlement-service';

export class CommercialFeatureLockedError extends Error {
  status = 402;
  code: string;
  details: Record<string, unknown>;

  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'CommercialFeatureLockedError';
    this.code = code;
    this.details = details;
  }
}

export function commercialFeatureLockedResponse(error: CommercialFeatureLockedError) {
  return Response.json({
    error: error.message,
    code: error.code,
    ...error.details,
  }, { status: error.status });
}

export async function assertCanCreateResume(userId: string, legacyAiCredits = 0) {
  const [profile, resumes] = await Promise.all([
    getUserEntitlementProfile(userId, legacyAiCredits),
    resumeRepository.findAllByUserId(userId),
  ]);
  const limit = getNumericEntitlement(profile, 'resume.max_count', 3);
  const current = resumes.length;
  if (limit > 0 && current >= limit) {
    throw new CommercialFeatureLockedError(
      'resume_limit_reached',
      `当前会员最多可创建 ${limit} 份简历，请升级会员后继续。`,
      {
        entitlement: 'resume.max_count',
        current,
        limit,
      },
    );
  }
  return { current, limit };
}

export async function assertCanExportResume(userId: string, format: string, legacyAiCredits = 0) {
  const profile = await getUserEntitlementProfile(userId, legacyAiCredits);
  const normalized = format === 'pdf-one-page' ? 'pdf' : format;
  const entitlementKey = normalized === 'docx'
    ? 'resume.export.docx'
    : normalized === 'pdf'
      ? 'resume.export.pdf'
      : '';
  if (!entitlementKey) return true;

  if (profile.entitlements[entitlementKey]) return true;
  throw new CommercialFeatureLockedError(
    'resume_export_locked',
    `${normalized.toUpperCase()} 导出需要升级会员。`,
    {
      entitlement: entitlementKey,
      format: normalized,
    },
  );
}
