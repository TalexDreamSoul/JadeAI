import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { jobTemplateRepository, toJobTemplate } from '@/lib/db/repositories/job-template.repository';

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  level: z.enum(['intern', 'junior', 'mid', 'senior']).optional(),
  industry: z.string().optional(),
  jd: z.string().min(1).optional(),
  keywords: z.array(z.string()).optional(),
  interviewQuestions: z.array(z.string()).optional(),
  recommendedSections: z.array(z.string()).optional(),
  enabled: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const existing = await jobTemplateRepository.findById(id);
    if (!existing || existing.ownerUserId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
    }

    const template = await jobTemplateRepository.update(id, parsed.data);
    return NextResponse.json(template ? {
      id: template.id,
      ...toJobTemplate(template),
      scope: 'personal',
      enabled: template.enabled,
    } : null);
  } catch (error) {
    console.error('PATCH /api/career/job-templates/personal/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

