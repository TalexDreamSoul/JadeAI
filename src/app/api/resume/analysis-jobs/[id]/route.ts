import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { resumeAnalysisJobRepository } from '@/lib/db/repositories/resume-analysis-job.repository';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function withoutAnalysisJob(themeConfig: unknown) {
  const next = asRecord(themeConfig);
  delete next.analysisJob;
  return next;
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const request = _request;
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    const job = await resumeAnalysisJobRepository.findByIdForUser(id, user.id);
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    const position = await resumeAnalysisJobRepository.getQueuePosition(job);
    return NextResponse.json({
      job: resumeAnalysisJobRepository.toPublicJob({ ...job, position }),
      message: buildJobMessage({ ...job, position }),
    });
  } catch (error) {
    console.error('GET /api/resume/analysis-jobs/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const request = _request;
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    const job = await resumeAnalysisJobRepository.findByIdForUser(id, user.id);
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    let deletedResumeId: string | null = null;
    if (job.resumeId) {
      const resume = await resumeRepository.findById(job.resumeId);
      if (resume?.userId === user.id) {
        const analysisJob = asRecord(asRecord(resume.themeConfig).analysisJob);
        if (analysisJob.id === job.id && job.status !== 'succeeded') {
          await resumeRepository.delete(resume.id);
          deletedResumeId = resume.id;
        } else if (analysisJob.id === job.id) {
          await resumeRepository.update(resume.id, { themeConfig: withoutAnalysisJob(resume.themeConfig) });
        }
      }
    }

    await resumeAnalysisJobRepository.delete(job.id);
    return NextResponse.json({ success: true, deletedResumeId });
  } catch (error) {
    console.error('DELETE /api/resume/analysis-jobs/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function buildJobMessage(job: { status: string; position: number; attempts: number; maxAttempts: number; errorMessage?: string | null }) {
  switch (job.status) {
    case 'queued':
      return job.position > 1 ? `任务排队中，当前第 ${job.position} 位。` : '任务排队中，即将开始分析。';
    case 'running':
      return `正在分析简历，第 ${job.attempts}/${job.maxAttempts} 次尝试。`;
    case 'retrying':
      return `上次分析失败，系统将自动重试（${job.attempts}/${job.maxAttempts}）：${job.errorMessage || '请稍候'}`;
    case 'succeeded':
      return '简历分析成功，可以进入编辑器查看结果。';
    case 'failed':
      return `简历分析失败：${job.errorMessage || '请检查文件后重新上传。'}`;
    default:
      return '任务状态已更新。';
  }
}
