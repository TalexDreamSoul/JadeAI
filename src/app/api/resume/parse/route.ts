import { NextRequest, NextResponse } from 'next/server';
import { AIConfigError, extractAIConfig } from '@/lib/ai/provider';
import { resolveUser, getUserIdFromRequest } from '@/lib/auth/helpers';
import { DEFAULT_TEMPLATE } from '@/lib/constants';
import { resumeAnalysisJobRepository } from '@/lib/db/repositories/resume-analysis-job.repository';
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
    const job = await resumeAnalysisJobRepository.create({
      userId: user.id,
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

    return NextResponse.json({
      job: resumeAnalysisJobRepository.toPublicJob({ ...job, position }),
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
