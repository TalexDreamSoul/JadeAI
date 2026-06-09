import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { shareRepository } from '@/lib/db/repositories/share.repository';

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    const limit = Math.min(200, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 100)));
    const minutes = Math.min(1440, Math.max(1, Number(request.nextUrl.searchParams.get('minutes') || 30)));
    const since = new Date(Date.now() - minutes * 60 * 1000);
    const presence = await shareRepository.listAllPresenceDetailed(limit, since);
    return NextResponse.json({ presence, windowMinutes: minutes });
  } catch (error) {
    console.error('GET /api/admin/review-presence error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
