import { NextRequest, NextResponse } from 'next/server';
import { JOB_TEMPLATES } from '@/lib/career/job-templates';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { jobTemplateRepository, toJobTemplate, type JobTemplateRecord } from '@/lib/db/repositories/job-template.repository';

export async function GET(request: NextRequest) {
  const user = await resolveUser(getUserIdFromRequest(request)).catch(() => null);
  const customTemplates = await jobTemplateRepository.listVisible(user?.id).catch(() => []);
  return NextResponse.json([
    ...JOB_TEMPLATES.map((template, index) => ({
      ...template,
      id: `builtin:${template.roleKey}`,
      scope: 'public',
      builtin: true,
      sortOrder: index,
    })),
    ...customTemplates.map((template: JobTemplateRecord) => ({
      id: template.id,
      ...toJobTemplate(template),
      scope: template.ownerUserId === user?.id ? 'personal' : 'public',
      builtin: false,
      enabled: template.enabled,
      sortOrder: template.sortOrder,
    })),
  ]);
}
