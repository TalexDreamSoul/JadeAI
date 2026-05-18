import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import { shareRepository } from '@/lib/db/repositories/share.repository';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const resume = await resumeRepository.findById(id);
    if (!resume) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (resume.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const shares = await shareRepository.findSummariesByResumeId(id);
    const summaries = await Promise.all(
      shares.map(async (share: Awaited<ReturnType<typeof shareRepository.findSummariesByResumeId>>[number]) => {
        const comments = await shareRepository.findCommentsByShareId(share.id);
        return {
          id: share.id,
          token: share.token,
          label: share.label,
          reviewEnabled: !!share.reviewEnabled,
          isActive: !!share.isActive,
          commentCount: Number(share.commentCount || 0),
          lastCommentAt: share.lastCommentAt || null,
          createdAt: share.createdAt,
          updatedAt: share.updatedAt,
          comments,
        };
      })
    );

    const aggregateComments = summaries.flatMap((share) =>
      share.comments.map((comment: Awaited<ReturnType<typeof shareRepository.findCommentsByShareId>>[number]) => ({
        ...comment,
        shareId: share.id,
        shareLabel: share.label,
      }))
    ).sort((a, b) => new Date(b.updatedAt as string | Date).getTime() - new Date(a.updatedAt as string | Date).getTime());

    return NextResponse.json({
      shares: summaries,
      aggregate: {
        id: 'all',
        label: '全部评审',
        commentCount: aggregateComments.length,
        lastCommentAt: aggregateComments[0]?.updatedAt || null,
        comments: aggregateComments,
      },
    });
  } catch (error) {
    console.error('GET /api/resume/[id]/review-summary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
