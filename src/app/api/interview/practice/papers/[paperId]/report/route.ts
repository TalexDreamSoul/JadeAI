import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { getInterviewPracticePaperReport } from '@/lib/commercial/interview-paper-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ paperId: string }> },
) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { paperId } = await params;
    const report = await getInterviewPracticePaperReport({
      userId: user.id,
      paperId,
    });
    if (!report.report.total) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(report);
  } catch (error) {
    console.error('GET /api/interview/practice/papers/[paperId]/report error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
