import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { orderRepository } from '@/lib/db/repositories/commercial.repository';

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    const limit = Math.min(200, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 100)));
    const status = request.nextUrl.searchParams.get('status') || undefined;
    const orders = await orderRepository.listAllDetailed(limit, status && status !== 'all' ? status : undefined);
    return NextResponse.json({ orders });
  } catch (error) {
    console.error('GET /api/admin/orders error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
