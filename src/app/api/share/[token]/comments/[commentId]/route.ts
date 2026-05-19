import { NextRequest, NextResponse } from 'next/server';
import { shareRepository } from '@/lib/db/repositories/share.repository';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { hashPassword } from '@/lib/utils/share';

async function resolveShare(token: string, password: string | null, userId?: string) {
  const share = await shareRepository.findByToken(token);
  if (!share || !share.isActive) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  if (!share.reviewEnabled) return { error: NextResponse.json({ error: 'Review is disabled' }, { status: 403 }) };
  if (userId) {
    const resume = await resumeRepository.findById(share.resumeId);
    if (resume?.userId === userId) return { share };
  }
  if (share.password) {
    if (!password) return { error: NextResponse.json({ error: 'Password required', passwordRequired: true }, { status: 401 }) };
    if (await hashPassword(password) !== share.password) {
      return { error: NextResponse.json({ error: 'Invalid password', passwordRequired: true }, { status: 401 }) };
    }
  }
  return { share };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; commentId: string }> }
) {
  try {
    const { token, commentId } = await params;
    const body = await request.json().catch(() => ({}));
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Login required', loginRequired: true }, { status: 401 });
    const result = await resolveShare(token, body.password ? String(body.password) : null, user.id);
    if (result.error) return result.error;

    const status = String(body.status || '').trim();
    if (!['open', 'resolved'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const updated = await shareRepository.updateCommentStatus(commentId, status);
    if (!updated || updated.shareId !== result.share!.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    console.error('PATCH /api/share/[token]/comments/[commentId] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
