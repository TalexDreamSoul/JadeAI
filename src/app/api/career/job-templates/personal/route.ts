import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { jobTemplateRepository, toJobTemplate, type JobTemplateRecord } from '@/lib/db/repositories/job-template.repository';

const inputSchema = z.object({
  roleKey: z.string().optional(),
  title: z.string().min(1),
  level: z.enum(['intern', 'junior', 'mid', 'senior']).default('mid'),
  industry: z.string().default('个人模板'),
  jd: z.string().min(1),
  keywords: z.array(z.string()).default([]),
  interviewQuestions: z.array(z.string()).default([]),
  recommendedSections: z.array(z.string()).default(['个人简介', '工作经历', '项目经历', '技能特长']),
  enabled: z.boolean().default(false),
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'custom-role';
}

export async function GET(request: NextRequest) {
  const user = await resolveUser(getUserIdFromRequest(request));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const templates = await jobTemplateRepository.listByOwner(user.id);
  return NextResponse.json(templates.map((template: JobTemplateRecord) => ({
    id: template.id,
    ...toJobTemplate(template),
    scope: 'personal',
    enabled: template.enabled,
  })));
}

export async function POST(request: NextRequest) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = inputSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
    }

    const roleKey = parsed.data.roleKey?.trim()
      || `personal-${user.id.slice(0, 8)}-${slugify(parsed.data.title)}-${Date.now().toString(36)}`;
    const template = await jobTemplateRepository.create({
      ...parsed.data,
      roleKey,
      ownerUserId: user.id,
      sortOrder: 500,
    });

    return NextResponse.json(template ? {
      id: template.id,
      ...toJobTemplate(template),
      scope: 'personal',
      enabled: template.enabled,
    } : null, { status: 201 });
  } catch (error) {
    console.error('POST /api/career/job-templates/personal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

