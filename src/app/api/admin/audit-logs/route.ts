import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { adminAuditRepository } from '@/lib/db/repositories/commercial.repository';

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    const limit = Math.min(200, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 100)));
    const targetUserId = request.nextUrl.searchParams.get('targetUserId') || undefined;
    const logs = await adminAuditRepository.list(limit, targetUserId);
    return NextResponse.json({ logs });
  } catch (error) {
    console.error('GET /api/admin/audit-logs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
