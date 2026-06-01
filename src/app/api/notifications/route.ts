import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { dbReady } from '@/lib/db';
import { notificationRepository } from '@/lib/db/repositories/notification.repository';

export async function GET(request: NextRequest) {
  try {
    await dbReady;
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limit = Math.min(50, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 20)));
    const notifications = await notificationRepository.listForUser(user.id, limit);
    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('GET /api/notifications error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await dbReady;
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body.ids)
      ? body.ids.map((id: unknown) => String(id)).filter(Boolean)
      : undefined;
    await notificationRepository.markRead(user.id, ids);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('PATCH /api/notifications error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
