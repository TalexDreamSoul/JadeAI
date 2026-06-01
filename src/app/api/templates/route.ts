import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { ensureCommercialCatalog } from '@/lib/commercial/bootstrap';
import { templateMarketRepository } from '@/lib/db/repositories/template-market.repository';
import { ensureResumeTemplateAccessPayload } from '@/lib/commercial/content-entitlement-service';
import { templateMarketItems } from '@/lib/db/schema';

type TemplateMarketItem = typeof templateMarketItems.$inferSelect;

export async function GET(request: NextRequest) {
  try {
    await ensureCommercialCatalog();
    const user = await resolveUser(getUserIdFromRequest(request)).catch(() => null);
    const templates = await templateMarketRepository.listVisible(user?.id);
    const enriched = await Promise.all((templates as TemplateMarketItem[]).map(async (template) => {
      if (!user) {
        return { ...template, product: null, purchased: false, locked: true, freeDownloads: null };
      }
      const { product, access } = await ensureResumeTemplateAccessPayload({
        userId: user.id,
        templateId: template.id,
        name: template.name,
        description: template.description,
        owner: template.ownerUserId === user.id,
        admin: user.role === 'admin',
        legacyAiCredits: Number(user.aiCredits || 0),
      });
      return {
        ...template,
        product,
        purchased: access.entitled,
        locked: !access.entitled && !access.canUseMonthlyFreeDownload,
        freeDownloads: access.freeDownloads,
        canUseMonthlyFreeDownload: access.canUseMonthlyFreeDownload,
      };
    }));
    return NextResponse.json(enriched);
  } catch (error) {
    console.error('GET /api/templates error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const name = String(body.name || '').trim();
    if (!name) return NextResponse.json({ error: 'Template name is required' }, { status: 400 });

    const item = await templateMarketRepository.create({
      ownerUserId: user.id,
      name,
      description: String(body.description || ''),
      baseTemplate: String(body.baseTemplate || 'touch-pure'),
      themeConfig: body.themeConfig || {},
      customCss: String(body.customCss || ''),
      isPublic: Boolean(body.isPublic),
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error('POST /api/templates error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
