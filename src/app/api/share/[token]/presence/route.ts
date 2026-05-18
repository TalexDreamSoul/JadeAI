import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { getReviewerDisplay, presenceColorForUser } from '@/lib/share/review';
import { shareRepository } from '@/lib/db/repositories/share.repository';
import { hashPassword } from '@/lib/utils/share';

async function resolveShare(token: string, password: string | null) {
  const share = await shareRepository.findByToken(token);
  if (!share || !share.isActive) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  if (!share.reviewEnabled) return { error: NextResponse.json({ error: 'Review is disabled' }, { status: 403 }) };
  if (share.password) {
    if (!password) return { error: NextResponse.json({ error: 'Password required', passwordRequired: true }, { status: 401 }) };
    if (await hashPassword(password) !== share.password) {
      return { error: NextResponse.json({ error: 'Invalid password', passwordRequired: true }, { status: 401 }) };
    }
  }
  return { share };
}

type PresenceLike = {
  id?: string;
  userId?: string;
  reviewerName?: string | null;
  reviewerEmail?: string | null;
  reviewerAvatarUrl?: string | null;
  cursorX?: number;
  cursorY?: number;
  color?: string;
  lastSeenAt?: unknown;
};

function sanitizePresence(item: unknown, anonymousShare: boolean, currentUserId?: string) {
  const presence = item as PresenceLike;
  const isSelf = !!currentUserId && presence.userId === currentUserId;
  return {
    id: presence.id,
    userId: presence.userId,
    reviewerName: anonymousShare && !isSelf ? `${String(presence.reviewerName || 'R').slice(0, 1)}***` : presence.reviewerName,
    reviewerEmail: anonymousShare ? null : presence.reviewerEmail,
    reviewerAvatarUrl: anonymousShare && !isSelf ? null : presence.reviewerAvatarUrl,
    cursorX: presence.cursorX,
    cursorY: presence.cursorY,
    color: presence.color,
    lastSeenAt: presence.lastSeenAt,
    isSelf,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const result = await resolveShare(token, request.nextUrl.searchParams.get('password'));
  if (result.error) return result.error;

  const user = await resolveUser(getUserIdFromRequest(request));
  if (result.share!.viewRequiresLogin && !user) {
    return NextResponse.json({ error: 'Login required', loginRequired: true }, { status: 401 });
  }

  const since = new Date(Date.now() - 30_000);
  const rows = await shareRepository.findActivePresence(result.share!.id, since);
  return NextResponse.json(rows.map((item: unknown) => sanitizePresence(item, !!result.share!.anonymousShare, user?.id)));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json().catch(() => ({}));
    const result = await resolveShare(token, body.password ? String(body.password) : null);
    if (result.error) return result.error;

    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Login required', loginRequired: true }, { status: 401 });

    const reviewer = getReviewerDisplay(user);
    const cursorX = Number(body.cursorX);
    const cursorY = Number(body.cursorY);
    await shareRepository.upsertPresence({
      shareId: result.share!.id,
      resumeId: result.share!.resumeId,
      userId: user.id,
      reviewerName: reviewer.name,
      reviewerEmail: reviewer.email,
      reviewerAvatarUrl: reviewer.avatarUrl,
      cursorX: Number.isFinite(cursorX) ? cursorX : 0,
      cursorY: Number.isFinite(cursorY) ? cursorY : 0,
      color: presenceColorForUser(user.id),
    });

    const since = new Date(Date.now() - 30_000);
    const rows = await shareRepository.findActivePresence(result.share!.id, since);
    return NextResponse.json(rows.map((item: unknown) => sanitizePresence(item, !!result.share!.anonymousShare, user.id)));
  } catch (error) {
    console.error('POST /api/share/[token]/presence error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
