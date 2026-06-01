import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { aiUsageRepository } from '@/lib/db/repositories/commercial.repository';

export async function GET(request: NextRequest) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 20)));
    const usage = await aiUsageRepository.listForUser(user.id, limit);
    return NextResponse.json({ usage });
  } catch (error) {
    console.error('GET /api/ai/usage error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
