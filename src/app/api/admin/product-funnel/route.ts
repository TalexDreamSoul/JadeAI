import { NextRequest, NextResponse } from 'next/server';
import { getProductFunnel } from '@/lib/analytics/product-event-service';
import { requireAdmin } from '@/lib/auth/admin';

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    const rawDays = request.nextUrl.searchParams.get('days') || '7';
    if (rawDays !== '7' && rawDays !== '30') {
      return NextResponse.json({ error: 'days must be 7 or 30' }, { status: 400 });
    }

    return NextResponse.json(await getProductFunnel(Number(rawDays) as 7 | 30));
  } catch (error) {
    console.error('GET /api/admin/product-funnel error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
