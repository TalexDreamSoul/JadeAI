import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import {
  ensureResumeTemplateAccessPayload,
  grantMonthlyFreeDownload,
} from '@/lib/commercial/content-entitlement-service';
import { templateMarketRepository } from '@/lib/db/repositories/template-market.repository';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await resolveUser(getUserIdFromRequest(request)).catch(() => null);
    const existing = await templateMarketRepository.findById(id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { product, access } = await ensureResumeTemplateAccessPayload({
      userId: user.id,
      templateId: existing.id,
      name: existing.name,
      description: existing.description,
      owner: existing.ownerUserId === user.id,
      admin: user.role === 'admin',
      legacyAiCredits: Number(user.aiCredits || 0),
    });

    if (!access.entitled) {
      const freeGrant = await grantMonthlyFreeDownload({
        userId: user.id,
        resourceType: 'resume_template',
        resourceId: existing.id,
        product,
        name: existing.name,
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

    const item = await templateMarketRepository.incrementInstallCount(id);
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({
      ...item,
      product,
      purchased: true,
      locked: false,
    });
  } catch (error) {
    console.error('POST /api/templates/[id]/install error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
