import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import {
  ensureResumeTemplateAccessPayload,
  grantMonthlyFreeDownload,
} from '@/lib/commercial/content-entitlement-service';
import { templateMarketRepository } from '@/lib/db/repositories/template-market.repository';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const template = await templateMarketRepository.findById(id);
    if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { product, access } = await ensureResumeTemplateAccessPayload({
      userId: user.id,
      templateId: template.id,
      name: template.name,
      description: template.description,
      owner: template.ownerUserId === user.id,
      admin: user.role === 'admin',
      legacyAiCredits: Number(user.aiCredits || 0),
    });

    if (!access.entitled) {
      const freeGrant = await grantMonthlyFreeDownload({
        userId: user.id,
        resourceType: 'resume_template',
        resourceId: template.id,
        product,
        name: template.name,
        legacyAiCredits: Number(user.aiCredits || 0),
      });
      if (freeGrant.granted) {
        access.entitled = true;
      } else {
        const freeDownloads = freeGrant.state.freeDownloads;
        return NextResponse.json({
          error: 'Payment required',
          code: 'content_payment_required',
          product,
          freeDownloads,
        }, { status: 402 });
      }
    }

    const payload = {
      id: template.id,
      key: template.key,
      name: template.name,
      description: template.description,
      baseTemplate: template.baseTemplate,
      themeConfig: template.themeConfig,
      customCss: template.customCss,
      downloadedAt: new Date().toISOString(),
    };
    const filename = `${template.key || template.id}.resume-template.json`;

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename=\"${filename}\"`,
      },
    });
  } catch (error) {
    console.error('GET /api/templates/[id]/download error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
