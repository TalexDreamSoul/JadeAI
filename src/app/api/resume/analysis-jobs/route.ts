import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { resumeAnalysisJobRepository } from '@/lib/db/repositories/resume-analysis-job.repository';

export async function GET(request: NextRequest) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limit = Math.min(50, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 20)));
    const jobs = await resumeAnalysisJobRepository.listForUser(user.id, limit);
    const publicJobs = await Promise.all(jobs.map(async (job: NonNullable<Awaited<ReturnType<typeof resumeAnalysisJobRepository.findById>>>) => ({
      ...resumeAnalysisJobRepository.toPublicJob(job),
      position: await resumeAnalysisJobRepository.getQueuePosition(job),
    })));

    return NextResponse.json({ jobs: publicJobs });
  } catch (error) {
    console.error('GET /api/resume/analysis-jobs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
