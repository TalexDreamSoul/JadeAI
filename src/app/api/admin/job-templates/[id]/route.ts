import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { JOB_TEMPLATES } from '@/lib/career/job-templates';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { jobTemplateRepository, toJobTemplate } from '@/lib/db/repositories/job-template.repository';

const updateSchema = z.object({
  roleKey: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).optional(),
  level: z.enum(['intern', 'junior', 'mid', 'senior']).optional(),
  industry: z.string().optional(),
  jd: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  interviewQuestions: z.array(z.string()).optional(),
  recommendedSections: z.array(z.string()).optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

async function requireAdmin(request: NextRequest) {
  const user = await resolveUser(getUserIdFromRequest(request));
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (user.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { user };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    const { id } = await params;
    const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
    }

    if (parsed.data.roleKey) {
      const existsInBuiltin = JOB_TEMPLATES.some((template) => template.roleKey === parsed.data.roleKey);
      if (existsInBuiltin) {
        return NextResponse.json({ error: 'roleKey is reserved by a built-in template', code: 'reserved_role_key' }, { status: 409 });
      }

      const existingCustom = await jobTemplateRepository.findByRoleKey(parsed.data.roleKey);
      if (existingCustom && existingCustom.id !== id) {
        return NextResponse.json({ error: 'roleKey already exists', code: 'duplicate_role_key' }, { status: 409 });
      }
    }

    const template = await jobTemplateRepository.update(id, parsed.data);
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    return NextResponse.json({ id: template.id, ...toJobTemplate(template), enabled: template.enabled, sortOrder: template.sortOrder });
  } catch (error) {
    console.error('PATCH /api/admin/job-templates/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
