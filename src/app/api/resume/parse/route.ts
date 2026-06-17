import { NextRequest, NextResponse } from 'next/server';
import { AIConfigError, extractAIConfig } from '@/lib/ai/provider';
import { resolveUser, getUserIdFromRequest } from '@/lib/auth/helpers';
import { DEFAULT_TEMPLATE } from '@/lib/constants';
import { resumeAnalysisJobRepository } from '@/lib/db/repositories/resume-analysis-job.repository';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import {
  ACCEPTED_RESUME_ANALYSIS_TYPES,
  MAX_RESUME_ANALYSIS_FILE_SIZE,
} from '@/lib/resume-analysis/parse-service';
import {
  assertCanCreateResume,
  commercialFeatureLockedResponse,
  CommercialFeatureLockedError,
} from '@/lib/commercial/feature-gate-service';

const MAX_ACTIVE_JOBS_PER_USER = 3;

function titleFromFileName(fileName: string) {
  const cleaned = fileName.replace(/\.[^.]+$/, '').trim();
  return cleaned || '解析中的简历';
}

function analysisThemeConfig(jobId: string, status = 'queued') {
  return {
    analysisJob: {
      id: jobId,
      status,
      progress: 0,
      position: 0,
      attempts: 0,
      maxAttempts: 3,
      message: '简历已上传，正在排队解析。',
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const fingerprint = getUserIdFromRequest(request);
    const user = await resolveUser(fingerprint);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await assertCanCreateResume(user.id, Number(user.aiCredits || 0));
    await extractAIConfig(request);

    const activeCount = await resumeAnalysisJobRepository.countActiveByUserId(user.id);
    if (activeCount >= MAX_ACTIVE_JOBS_PER_USER) {
      return NextResponse.json({
        error: '当前已有 3 个待分析任务，请等待完成后再上传',
        code: 'resume_analysis_queue_limit_reached',
        activeCount,
        limit: MAX_ACTIVE_JOBS_PER_USER,
      }, { status: 429 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const template = (formData.get('template') as string) || DEFAULT_TEMPLATE;
    const language = (formData.get('language') as string) || 'zh';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ACCEPTED_RESUME_ANALYSIS_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Accepted: PDF, PNG, JPG, WebP' },
        { status: 400 },
      );
    }

    if (file.size > MAX_RESUME_ANALYSIS_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size: 10MB' },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const jobId = crypto.randomUUID();
    const placeholder = await resumeRepository.create({
      userId: user.id,
      title: `${titleFromFileName(file.name || 'resume-upload')}（解析中）`,
      template,
      language,
      themeConfig: analysisThemeConfig(jobId),
    });
    if (!placeholder) throw new Error('Failed to create placeholder resume');
    await resumeRepository.createSection({
      resumeId: placeholder.id,
      type: 'personal_info',
      title: language === 'en' ? 'Personal Info' : '个人信息',
      sortOrder: 0,
      content: { fullName: '', jobTitle: '解析中', email: '', phone: '', location: '' },
    });

    const job = await resumeAnalysisJobRepository.create({
      id: jobId,
      userId: user.id,
      resumeId: placeholder.id,
      fileName: file.name || 'resume-upload',
      fileType: file.type,
      fileSize: file.size,
      fileData: buffer.toString('base64'),
      template,
      language,
      metadata: { source: 'upload' },
    });

    if (!job) throw new Error('Failed to create analysis job');
    const position = await resumeAnalysisJobRepository.getQueuePosition(job);

    const publicJob = resumeAnalysisJobRepository.toPublicJob({ ...job, position });
    return NextResponse.json({
      job: publicJob,
      resume: {
        ...placeholder,
        themeConfig: {
          ...(placeholder.themeConfig && typeof placeholder.themeConfig === 'object' ? placeholder.themeConfig : {}),
          analysisJob: {
            id: job.id,
            status: job.status,
            progress: job.progress,
            position,
            attempts: job.attempts,
            maxAttempts: job.maxAttempts,
            message: position > 1 ? `当前排队第 ${position} 位。` : '即将开始分析。',
          },
        },
      },
      message: position > 1
        ? `简历已上传，当前排队第 ${position} 位。后台将按顺序自动分析。`
        : '简历已上传，后台将开始分析。',
      limit: MAX_ACTIVE_JOBS_PER_USER,
      activeCount: activeCount + 1,
    }, { status: 202 });
  } catch (error) {
    if (error instanceof AIConfigError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof CommercialFeatureLockedError) {
      return commercialFeatureLockedResponse(error);
    }
    console.error('POST /api/resume/parse error:', error);
    return NextResponse.json({ error: 'Failed to enqueue resume analysis' }, { status: 500 });
  }
}
