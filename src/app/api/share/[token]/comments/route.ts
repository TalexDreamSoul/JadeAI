import { NextRequest, NextResponse } from 'next/server';
import { shareRepository } from '@/lib/db/repositories/share.repository';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import { analysisRepository } from '@/lib/db/repositories/analysis.repository';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { anonymizeDisplayName, getReviewerDisplay, isReviewLoginRequired } from '@/lib/share/review';
import { hashPassword } from '@/lib/utils/share';

type AuthenticatedUser = NonNullable<Awaited<ReturnType<typeof resolveUser>>>;

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

async function resolveReviewer(request: NextRequest): Promise<AuthenticatedUser | null> {
  return resolveUser(getUserIdFromRequest(request));
}

type CommentLike = {
  authorName?: string | null;
  authorEmail?: string | null;
  authorUserId?: string | null;
  [key: string]: unknown;
};

function sanitizeComment(comment: unknown, anonymousShare: boolean) {
  const item = comment as CommentLike;
  if (!anonymousShare) return item;
  return {
    ...item,
    authorName: anonymizeDisplayName(item.authorName),
    authorEmail: null,
    authorUserId: undefined,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const result = await resolveShare(token, request.nextUrl.searchParams.get('password'));
  if (result.error) return result.error;
  if (result.share!.viewRequiresLogin) {
    const user = await resolveReviewer(request);
    if (!user) return NextResponse.json({ error: 'Login required', loginRequired: true }, { status: 401 });
  }
  const comments = await shareRepository.findCommentsByShareId(result.share!.id);
  return NextResponse.json(comments.map((comment: unknown) => sanitizeComment(comment, !!result.share!.anonymousShare)));
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

    const reviewer = await resolveReviewer(request);
    if (isReviewLoginRequired() && !reviewer) {
      return NextResponse.json({ error: 'Login required', loginRequired: true }, { status: 401 });
    }

    const content = String(body.content || '').trim();
    if (!content) return NextResponse.json({ error: 'Comment content is required' }, { status: 400 });

    const reviewerDisplay = reviewer ? getReviewerDisplay(reviewer) : {
      name: String(body.authorName || '').trim() || 'Reviewer',
      email: body.authorEmail ? String(body.authorEmail) : null,
      avatarUrl: null,
    };

    const selectedText = String(body.selectedText || '').trim();
    const sectionId = body.sectionId ? String(body.sectionId) : null;
    const comment = await shareRepository.createComment({
      shareId: result.share!.id,
      resumeId: result.share!.resumeId,
      parentCommentId: body.parentCommentId ? String(body.parentCommentId) : null,
      authorUserId: reviewer?.id || null,
      authorName: reviewerDisplay.name,
      authorEmail: reviewerDisplay.email,
      sectionId,
      selectedText: selectedText || null,
      anchor: body.anchor && typeof body.anchor === 'object' ? body.anchor : null,
      content,
    });
    const suggestedText = typeof body.suggestedText === 'string' ? body.suggestedText.trim() : '';
    if (comment && suggestedText) {
      const resume = await resumeRepository.findById(result.share!.resumeId).catch(() => null);
      const section = sectionId && resume?.sections ? resume.sections.find((item: { id: string }) => item.id === sectionId) : null;
      await analysisRepository.createChangeProposal({
        resumeId: result.share!.resumeId,
        userId: reviewer?.id || null,
        source: 'review',
        sourceId: comment.id,
        shareId: result.share!.id,
        commentId: comment.id,
        sectionId,
        sectionType: section?.type || String(body.sectionType || 'summary'),
        targetField: String(body.targetField || 'text'),
        current: selectedText,
        suggested: suggestedText,
        reason: content,
        evidenceRequired: false,
        metadata: { token },
      }).catch((error) => console.error('Failed to create review change proposal:', error));
    }
    const owner = await resumeRepository.findOwnerByResumeId(result.share!.resumeId);
    if (owner?.id && owner.id !== reviewer?.id) {
      await resumeRepository.createEvent({
        resumeId: result.share!.resumeId,
        userId: owner.id,
        type: 'notification_review_comment',
        title: '简历收到新评论',
        description: `${reviewerDisplay.name} 评论了你的分享简历。`,
        metadata: {
          shareId: result.share!.id,
          commentId: comment?.id,
          reviewerName: reviewerDisplay.name,
          selectedText: selectedText || null,
        },
      });
    }
    return NextResponse.json(sanitizeComment(comment, !!result.share!.anonymousShare), { status: 201 });
  } catch (error) {
    console.error('POST /api/share/[token]/comments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
