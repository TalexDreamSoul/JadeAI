import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import {
  ensureJobTemplateAccessPayload,
  grantMonthlyFreeDownload,
  grantPlanDownloadEntitlement,
} from '@/lib/commercial/content-entitlement-service';
import { jobTemplateRepository, toJobTemplate } from '@/lib/db/repositories/job-template.repository';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await resolveUser(getUserIdFromRequest(request)).catch(() => null);
    const template = await jobTemplateRepository.findById(id);
    if (!template || (!template.enabled && template.ownerUserId !== user?.id)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { product, access } = await ensureJobTemplateAccessPayload({
      userId: user.id,
      jobTemplateId: template.id,
      name: template.title,
      description: template.jd.slice(0, 160),
      owner: template.ownerUserId === user.id,
      admin: user.role === 'admin',
      legacyAiCredits: Number(user.aiCredits || 0),
    });

    if (access.planEntitled && !access.directEntitled && !access.owned) {
      await grantPlanDownloadEntitlement({
        userId: user.id,
        resourceType: 'job_template',
        resourceId: template.id,
        product,
        name: template.title,
        legacyAiCredits: Number(user.aiCredits || 0),
      });
    }

    if (!access.entitled) {
      const freeGrant = await grantMonthlyFreeDownload({
        userId: user.id,
        resourceType: 'job_template',
        resourceId: template.id,
        product,
        name: template.title,
        legacyAiCredits: Number(user.aiCredits || 0),
      });
      if (!freeGrant.granted) {
        const freeDownloads = freeGrant.state.freeDownloads;
        return NextResponse.json({
          error: 'Payment required',
          code: 'content_payment_required',
          product,
          freeDownloads,
        }, { status: 402 });
      }
    }

    return NextResponse.json({
      id: template.id,
      ...toJobTemplate(template),
      scope: template.ownerUserId === user?.id ? 'personal' : 'public',
      builtin: false,
      enabled: template.enabled,
      sortOrder: template.sortOrder,
      product,
      purchased: true,
      locked: false,
    });
  } catch (error) {
    console.error('GET /api/career/job-templates/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
