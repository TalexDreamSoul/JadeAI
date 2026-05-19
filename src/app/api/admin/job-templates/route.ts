import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { JOB_TEMPLATES } from '@/lib/career/job-templates';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { jobTemplateRepository, toJobTemplate, type JobTemplateRecord } from '@/lib/db/repositories/job-template.repository';

const levelSchema = z.enum(['intern', 'junior', 'mid', 'senior']);
const inputSchema = z.object({
  roleKey: z.string().min(1),
  title: z.string().min(1),
  level: levelSchema.default('mid'),
  industry: z.string().default(''),
  jd: z.string().default(''),
  keywords: z.array(z.string()).default([]),
  interviewQuestions: z.array(z.string()).default([]),
  recommendedSections: z.array(z.string()).default([]),
  enabled: z.boolean().default(true),
  sortOrder: z.number().int().default(1000),
});

async function requireAdmin(request: NextRequest) {
  const user = await resolveUser(getUserIdFromRequest(request));
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (user.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { user };
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin.error) return admin.error;

  const customTemplates = await jobTemplateRepository.listAll();
  return NextResponse.json({
    builtin: JOB_TEMPLATES.map((template, index) => ({
      ...template,
      id: `builtin:${template.roleKey}`,
      enabled: true,
      builtin: true,
      sortOrder: index,
    })),
    custom: customTemplates.map((template: JobTemplateRecord) => ({
      id: template.id,
      ...toJobTemplate(template),
      enabled: Boolean(template.enabled),
      builtin: false,
      sortOrder: Number(template.sortOrder) || 1000,
    })),
  });
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    const parsed = inputSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
    }

    const existsInBuiltin = JOB_TEMPLATES.some((template) => template.roleKey === parsed.data.roleKey);
    if (existsInBuiltin) {
      return NextResponse.json({ error: 'roleKey is reserved by a built-in template' }, { status: 409 });
    }

    const template = await jobTemplateRepository.create({
      ...parsed.data,
      ownerUserId: admin.user.id,
    });
    return NextResponse.json(template ? { id: template.id, ...toJobTemplate(template), enabled: template.enabled } : null, { status: 201 });
  } catch (error) {
    console.error('POST /api/admin/job-templates error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

