import { NextResponse } from 'next/server';
import { templateMarketRepository } from '@/lib/db/repositories/template-market.repository';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const item = await templateMarketRepository.incrementInstallCount(id);
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(item);
  } catch (error) {
    console.error('POST /api/templates/[id]/install error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
