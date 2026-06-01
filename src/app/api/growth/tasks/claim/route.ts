import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { claimGrowthTask } from '@/lib/commercial/growth-service';

export async function POST(request: NextRequest) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const result = await claimGrowthTask(user.id, String(body.taskId || ''));
    return NextResponse.json(result);
  } catch (error) {
    console.error('POST /api/growth/tasks/claim error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: message === 'Internal server error' ? 500 : 400 });
  }
}
