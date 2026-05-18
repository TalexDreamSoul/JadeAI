import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { templateMarketRepository } from '@/lib/db/repositories/template-market.repository';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const item = await templateMarketRepository.findById(id);
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const updated = await templateMarketRepository.update(id, {
      ...(body.name !== undefined ? { name: String(body.name) } : {}),
      ...(body.description !== undefined ? { description: String(body.description) } : {}),
      ...(body.baseTemplate !== undefined ? { baseTemplate: String(body.baseTemplate) } : {}),
      ...(body.themeConfig !== undefined ? { themeConfig: body.themeConfig } : {}),
      ...(body.customCss !== undefined ? { customCss: String(body.customCss) } : {}),
      ...(body.isPublic !== undefined ? { isPublic: Boolean(body.isPublic) } : {}),
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PATCH /api/templates/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
