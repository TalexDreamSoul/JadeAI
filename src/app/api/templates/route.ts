import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { templateMarketRepository } from '@/lib/db/repositories/template-market.repository';

export async function GET(request: NextRequest) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request)).catch(() => null);
    return NextResponse.json(await templateMarketRepository.listVisible(user?.id));
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
