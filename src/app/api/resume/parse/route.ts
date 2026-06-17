import { NextRequest, NextResponse } from 'next/server';
import { AIConfigError, extractAIConfig } from '@/lib/ai/provider';
import { resolveUser, getUserIdFromRequest } from '@/lib/auth/helpers';
import { DEFAULT_TEMPLATE } from '@/lib/constants';
import { dbReady } from '@/lib/db';
import { resumeAnalysisJobRepository } from '@/lib/db/repositories/resume-analysis-job.repository';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import { databaseStoredObject, storeObject, type StoredObject } from '@/lib/storage/object-storage';
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

function extensionFromFileName(fileName: string) {
  const match = fileName.match(/\.([a-z0-9]+)$/i);
  return match ? `.${match[1].toLowerCase()}` : '';
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || '未知错误');
}

function describeEnqueueError(error: unknown) {
  const message = errorMessage(error);
  const lower = message.toLowerCase();
  if (lower.includes('formdata') || lower.includes('multipart') || lower.includes('failed to parse body')) {
    return {
      status: 400,
      code: 'resume_upload_parse_failed',
      error: '文件上传请求解析失败，请重新选择 PDF/图片文件后再试。',
      details: { raw: message.slice(0, 500) },
    };
  }
  if (lower.includes('payload too large') || lower.includes('request entity too large') || lower.includes('body exceeded')) {
    return {
      status: 413,
      code: 'resume_upload_too_large',
      error: '文件过大，请上传 10MB 以内的 PDF/图片文件。',
      details: { raw: message.slice(0, 500) },
    };
  }
  if (
    lower.includes('resume_analysis_jobs') ||
    lower.includes('no such table') ||
    lower.includes('does not exist') ||
    lower.includes('sqlite') ||
    lower.includes('postgres') ||
    lower.includes('drizzle')
  ) {
    return {
      status: 503,
      code: 'resume_analysis_storage_unavailable',
      error: '解析任务存储暂不可用，请稍后重试或联系管理员检查数据库迁移。',
      details: { raw: message.slice(0, 500) },
    };
  }
  return {
    status: 500,
    code: 'resume_analysis_enqueue_failed',
    error: '简历解析任务创建失败，请稍后重试或联系管理员。',
    details: { raw: message.slice(0, 500) },
  };
}

async function cleanupFailedEnqueue(input: { userId: string | null; resumeId: string | null }) {
  if (!input.userId || !input.resumeId) return;
  try {
    await resumeAnalysisJobRepository.deleteByResumeIdForUser(input.resumeId, input.userId);
    await resumeRepository.delete(input.resumeId);
  } catch (cleanupError) {
    console.warn('Failed to cleanup placeholder resume after enqueue error:', cleanupError);
  }
}

async function tryStoreUploadInQiniu(input: {
  jobId: string;
  userId: string;
  resumeId: string;
  fileName: string;
  fileType: string;
  buffer: Buffer;
}): Promise<StoredObject | null> {
  const objectKey = [
    'resume-analysis',
    input.userId,
    input.resumeId,
    `${input.jobId}${extensionFromFileName(input.fileName)}`,
  ].join('/');

  try {
    return await storeObject({
      key: objectKey,
      buffer: input.buffer,
      fileName: input.fileName,
      mimeType: input.fileType,
    });
  } catch (error) {
    console.warn('Qiniu upload failed; falling back to database fileData:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  let userId: string | null = null;
  let placeholderResumeId: string | null = null;
  try {
    await dbReady;
    const fingerprint = getUserIdFromRequest(request);
    const user = await resolveUser(fingerprint);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    userId = user.id;

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
    placeholderResumeId = placeholder.id;
    await resumeRepository.createSection({
      resumeId: placeholder.id,
      type: 'personal_info',
      title: language === 'en' ? 'Personal Info' : '个人信息',
      sortOrder: 0,
      content: { fullName: '', jobTitle: '解析中', email: '', phone: '', location: '' },
    });

    const storedObject = await tryStoreUploadInQiniu({
      jobId,
      userId: user.id,
      resumeId: placeholder.id,
      fileName: file.name || 'resume-upload',
      fileType: file.type,
      buffer,
    });
    const job = await resumeAnalysisJobRepository.create({
      id: jobId,
      userId: user.id,
      resumeId: placeholder.id,
      fileName: file.name || 'resume-upload',
      fileType: file.type,
      fileSize: file.size,
      fileData: storedObject ? '' : buffer.toString('base64'),
      template,
      language,
      metadata: {
        source: 'upload',
        storage: storedObject || databaseStoredObject(),
      },
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
    await cleanupFailedEnqueue({ userId, resumeId: placeholderResumeId });
    const described = describeEnqueueError(error);
    console.error('POST /api/resume/parse error:', { code: described.code, error });
    return NextResponse.json(described, { status: described.status });
  }
}
