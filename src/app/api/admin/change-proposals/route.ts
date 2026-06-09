import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { analysisRepository } from '@/lib/db/repositories/analysis.repository';

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    const limit = Math.min(200, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 100)));
    const status = request.nextUrl.searchParams.get('status') || undefined;
    const proposals = await analysisRepository.listAllChangeProposalsDetailed(limit, status && status !== 'all' ? status : undefined);
    return NextResponse.json({ proposals });
  } catch (error) {
    console.error('GET /api/admin/change-proposals error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
