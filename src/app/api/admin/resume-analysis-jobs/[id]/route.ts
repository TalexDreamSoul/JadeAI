import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { resumeAnalysisJobRepository } from '@/lib/db/repositories/resume-analysis-job.repository';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import { userRepository } from '@/lib/db/repositories/user.repository';

const REQUEUEABLE_STATUSES = new Set(['queued', 'running', 'retrying', 'failed']);

function analysisThemeConfig(job: NonNullable<Awaited<ReturnType<typeof resumeAnalysisJobRepository.findById>>>) {
  return {
    analysisJob: {
      id: job.id,
      status: 'queued',
      progress: 0,
      position: 0,
      attempts: 0,
      maxAttempts: job.maxAttempts,
      message: '管理员已重新入队，正在排队解析。',
    },
  };
}

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    const { id } = await params;
    const job = await resumeAnalysisJobRepository.findById(id);
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!REQUEUEABLE_STATUSES.has(job.status)) {
      return NextResponse.json({ error: 'Only active or failed jobs can be retried' }, { status: 409 });
    }

    const updated = await resumeAnalysisJobRepository.requeue(job.id);
    if (!updated) throw new Error('Failed to requeue analysis job');

    await resumeAnalysisJobRepository.appendLog(job.id, {
      level: 'info',
      message: '管理员手动重新入队解析任务',
      attempt: 0,
    });

    if (job.resumeId) {
      const resume = await resumeRepository.findById(job.resumeId);
      if (resume) {
        const themeConfig = resume.themeConfig && typeof resume.themeConfig === 'object' && !Array.isArray(resume.themeConfig)
          ? resume.themeConfig as Record<string, unknown>
          : {};
        await resumeRepository.update(resume.id, {
          title: resume.title.replace(/（解析失败）$/, '（解析中）'),
          themeConfig: {
            ...themeConfig,
            ...analysisThemeConfig(updated),
          },
        });
      }
    }

    const position = await resumeAnalysisJobRepository.getQueuePosition(updated);
    return NextResponse.json({
      job: resumeAnalysisJobRepository.toPublicJob({ ...updated, position }),
      message: position > 1 ? `已重新入队，当前排队第 ${position} 位。` : '已重新入队，即将开始分析。',
    });
  } catch (error) {
    console.error('POST /api/admin/resume-analysis-jobs/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
