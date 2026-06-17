import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { resumeAnalysisJobRepository } from '@/lib/db/repositories/resume-analysis-job.repository';

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    const limit = Math.min(200, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 100)));
    const status = request.nextUrl.searchParams.get('status') || undefined;
    const userId = request.nextUrl.searchParams.get('userId') || undefined;
    const workerId = request.nextUrl.searchParams.get('workerId') || undefined;

    const jobs = await resumeAnalysisJobRepository.listAll({
      limit,
      status: status && status !== 'all' ? status : undefined,
      userId,
      workerId,
    });

    return NextResponse.json({ jobs });
  } catch (error) {
    console.error('GET /api/admin/resume-analysis-jobs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
