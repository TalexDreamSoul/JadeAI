import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { resumeAnalysisJobRepository } from '@/lib/db/repositories/resume-analysis-job.repository';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';

const RETRY_STATUSES = new Set(['retrying', 'failed']);

function analysisThemeConfig(job: NonNullable<Awaited<ReturnType<typeof resumeAnalysisJobRepository.findById>>>) {
  return {
    analysisJob: {
      id: job.id,
      status: 'queued',
      progress: 0,
      position: 0,
      attempts: 0,
      maxAttempts: job.maxAttempts,
      message: '已重新提交，正在排队解析。',
    },
  };
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    const job = await resumeAnalysisJobRepository.findByIdForUser(id, user.id);
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (!RETRY_STATUSES.has(job.status)) {
      return NextResponse.json({ error: 'Only failed or retrying jobs can be retried' }, { status: 409 });
    }

    const activeCount = await resumeAnalysisJobRepository.countActiveByUserId(user.id);
    const retryingSameJob = resumeAnalysisJobRepository.activeStatuses.includes(job.status);
    if (!retryingSameJob && activeCount >= 3) {
      return NextResponse.json({ error: '当前已有 3 个待分析任务，请等待完成后再重试' }, { status: 429 });
    }

    const updated = await resumeAnalysisJobRepository.updateStatus(job.id, {
      status: 'queued',
      progress: 0,
      attempts: 0,
      workerId: null,
      lockedAt: null,
      lastHeartbeatAt: null,
      nextRunAt: new Date(),
      startedAt: null,
      finishedAt: null,
      errorCode: null,
      errorMessage: null,
    });
    if (!updated) throw new Error('Failed to retry analysis job');

    await resumeAnalysisJobRepository.appendLog(job.id, {
      level: 'info',
      message: '用户手动重新提交解析任务',
      attempt: 0,
    });

    if (job.resumeId) {
      const resume = await resumeRepository.findById(job.resumeId);
      if (resume?.userId === user.id) {
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
      message: position > 1 ? `已重新提交，当前排队第 ${position} 位。` : '已重新提交，即将开始分析。',
    });
  } catch (error) {
    console.error('POST /api/resume/analysis-jobs/[id]/retry error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
