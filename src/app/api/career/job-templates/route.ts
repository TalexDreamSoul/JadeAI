import { NextRequest, NextResponse } from 'next/server';
import { JOB_TEMPLATES } from '@/lib/career/job-templates';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { jobTemplateRepository, toJobTemplate, type JobTemplateRecord } from '@/lib/db/repositories/job-template.repository';
import { ensureJobTemplateAccessPayload } from '@/lib/commercial/content-entitlement-service';

export async function GET(request: NextRequest) {
  const user = await resolveUser(getUserIdFromRequest(request)).catch(() => null);
  const customTemplates = await jobTemplateRepository.listVisible(user?.id).catch(() => []);
  const custom = await Promise.all(customTemplates.map(async (template: JobTemplateRecord) => {
    if (!user) {
      return {
        id: template.id,
        roleKey: template.roleKey,
        title: template.title,
        level: template.level,
        industry: template.industry,
        jd: '',
        keywords: [],
        interviewQuestions: [],
        recommendedSections: [],
        scope: 'public',
        builtin: false,
        enabled: template.enabled,
        sortOrder: template.sortOrder,
        product: null,
        purchased: false,
        locked: true,
        canUseMonthlyFreeDownload: false,
        freeDownloads: null,
      };
    }
    const { product, access } = await ensureJobTemplateAccessPayload({
      userId: user.id,
      jobTemplateId: template.id,
      name: template.title,
      description: template.jd.slice(0, 160),
      owner: template.ownerUserId === user.id,
      admin: user.role === 'admin',
      legacyAiCredits: Number(user.aiCredits || 0),
    });
    const purchased = access.entitled;
    return {
      id: template.id,
      ...(purchased
        ? toJobTemplate(template)
        : {
            roleKey: template.roleKey,
            title: template.title,
            level: template.level,
            industry: template.industry,
            jd: '',
            keywords: [],
            interviewQuestions: [],
            recommendedSections: [],
          }),
      scope: template.ownerUserId === user?.id ? 'personal' : 'public',
      builtin: false,
      enabled: template.enabled,
      sortOrder: template.sortOrder,
      product,
      purchased,
      locked: !purchased && !access.canUseMonthlyFreeDownload,
      canUseMonthlyFreeDownload: access.canUseMonthlyFreeDownload,
      freeDownloads: access.freeDownloads,
    };
  }));
  return NextResponse.json([
    ...JOB_TEMPLATES.map((template, index) => ({
      ...template,
      id: `builtin:${template.roleKey}`,
      scope: 'public',
      builtin: true,
      sortOrder: index,
      purchased: true,
      locked: false,
    })),
    ...custom,
  ]);
}
