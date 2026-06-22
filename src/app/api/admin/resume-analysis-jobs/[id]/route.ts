import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { resumeAnalysisJobRepository } from '@/lib/db/repositories/resume-analysis-job.repository';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import { userRepository } from '@/lib/db/repositories/user.repository';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    const { id } = await params;
    const job = await resumeAnalysisJobRepository.findById(id);
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const [user, resume] = await Promise.all([
      userRepository.findById(job.userId),
      job.resumeId ? resumeRepository.findById(job.resumeId) : Promise.resolve(null),
    ]);

    return NextResponse.json({
      job: resumeAnalysisJobRepository.toPublicJob(job),
      user: user ? {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      } : null,
      resume,
    });
  } catch (error) {
    console.error('GET /api/admin/resume-analysis-jobs/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
