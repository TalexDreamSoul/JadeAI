import { dbReady } from '@/lib/db';
import { userRepository } from '@/lib/db/repositories/user.repository';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import { resumeAnalysisJobRepository, type ResumeAnalysisJobRecord } from '@/lib/db/repositories/resume-analysis-job.repository';
import { AIConfigError, resolveServerAIConfigForUser } from '@/lib/ai/provider';
import { AIUsageInsufficientCreditsError } from '@/lib/commercial/ai-route-metering';
import { analyzeResumeFile, describeResumeAnalysisError, ResumeAnalysisAITraceError } from './parse-service';
import { readStoredObject } from '@/lib/storage/object-storage';

export type ResumeAnalysisWorkerOptions = {
  workerId?: string;
  pollIntervalMs?: number;
  idleExit?: boolean;
  staleAfterMs?: number;
};

const DEFAULT_POLL_INTERVAL_MS = 3000;
const DEFAULT_STALE_AFTER_MS = 5 * 60 * 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || '未知错误');
}

function nextRetryAt(attempts: number) {
  const delaySeconds = Math.min(60, Math.max(5, attempts * 10));
  return new Date(Date.now() + delaySeconds * 1000);
}

function userFacingFailure(error: unknown) {
  if (error instanceof AIConfigError) return `${error.message} 请检查 AI 服务配置或账户权益后重试。`;
  if (error instanceof AIUsageInsufficientCreditsError) return `${error.message} 请充值或升级会员后重新上传。`;
  return describeResumeAnalysisError(error).message;
}

function resumeAnalysisTrace(error: unknown) {
  if (error instanceof ResumeAnalysisAITraceError) return error.trace;
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function progressFromMetadata(metadata: Record<string, unknown> | undefined, fallback: number) {
  const value = metadata?.progress;
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(99, Math.round(value)));
}

async function getAnalysisFileBuffer(job: ResumeAnalysisJobRecord): Promise<Buffer> {
  const metadata = asRecord(job.metadata);
  const storage = asRecord(metadata.storage);
  const storedBuffer = await readStoredObject(storage);
  if (storedBuffer) return storedBuffer;
  if (!job.fileData) {
    throw new Error('简历源文件不存在或存储配置不可用');
  }
  return Buffer.from(job.fileData, 'base64');
}

async function updateResumeAnalysisState(job: ResumeAnalysisJobRecord, patch: Record<string, unknown>) {
  if (!job.resumeId) return;
  const resume = await resumeRepository.findById(job.resumeId);
  if (!resume) return;
  const themeConfig = resume.themeConfig && typeof resume.themeConfig === 'object' && !Array.isArray(resume.themeConfig)
    ? resume.themeConfig as Record<string, unknown>
    : {};
  await resumeRepository.update(resume.id, {
    themeConfig: {
      ...themeConfig,
      analysisJob: {
        ...(themeConfig.analysisJob && typeof themeConfig.analysisJob === 'object' && !Array.isArray(themeConfig.analysisJob) ? themeConfig.analysisJob : {}),
        id: job.id,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        ...patch,
      },
    },
  });
}

export class ResumeAnalysisWorker {
  readonly workerId: string;
  private readonly pollIntervalMs: number;
  private readonly idleExit: boolean;
  private readonly staleAfterMs: number;
  private stopped = false;

  constructor(options: ResumeAnalysisWorkerOptions = {}) {
    this.workerId = options.workerId || `resume-worker-${process.pid}-${crypto.randomUUID().slice(0, 8)}`;
    this.pollIntervalMs = options.pollIntervalMs || DEFAULT_POLL_INTERVAL_MS;
    this.idleExit = options.idleExit || false;
    this.staleAfterMs = options.staleAfterMs || DEFAULT_STALE_AFTER_MS;
  }

  stop() {
    this.stopped = true;
  }

  async run() {
    await dbReady;
    console.log(`[resume-analysis-worker] started workerId=${this.workerId}`);

    while (!this.stopped) {
      await resumeAnalysisJobRepository.releaseStaleRunningJobs(new Date(Date.now() - this.staleAfterMs));
      const job = await resumeAnalysisJobRepository.claimNext(this.workerId);
      if (!job) {
        if (this.idleExit) break;
        await sleep(this.pollIntervalMs);
        continue;
      }

      await this.process(job).catch((error) => {
        console.error(`[resume-analysis-worker] fatal job error jobId=${job.id}`, error);
      });
    }

    console.log(`[resume-analysis-worker] stopped workerId=${this.workerId}`);
  }

  async runOnce() {
    await dbReady;
    await resumeAnalysisJobRepository.releaseStaleRunningJobs(new Date(Date.now() - this.staleAfterMs));
    const job = await resumeAnalysisJobRepository.claimNext(this.workerId);
    if (!job) return null;
    await this.process(job);
    return job.id;
  }

  private async process(job: ResumeAnalysisJobRecord) {
    try {
      await resumeAnalysisJobRepository.updateStatus(job.id, { progress: 20 });
      await updateResumeAnalysisState(job, { status: 'running', progress: 20, message: '正在分析简历。' });
      const user = await userRepository.findById(job.userId);
      if (!user) throw new Error('用户不存在，无法继续分析');

      const aiConfig = await resolveServerAIConfigForUser(user);
      await resumeAnalysisJobRepository.heartbeat(job.id, this.workerId);
      const fileBuffer = await getAnalysisFileBuffer(job);

      const resume = await analyzeResumeFile({
        userId: job.userId,
        aiConfig,
        file: {
          name: job.fileName,
          type: job.fileType,
          size: job.fileSize,
          buffer: fileBuffer,
        },
        template: job.template,
        language: job.language,
        resumeId: job.resumeId,
        onProgress: async (message, metadata) => {
          const latest = await resumeAnalysisJobRepository.findById(job.id);
          const progress = progressFromMetadata(metadata, latest?.progress || 20);
          await resumeAnalysisJobRepository.heartbeat(job.id, this.workerId);
          await resumeAnalysisJobRepository.updateStatus(job.id, { progress });
          await updateResumeAnalysisState(job, {
            status: 'running',
            progress,
            attempts: latest?.attempts || job.attempts,
            message,
          });
          await resumeAnalysisJobRepository.appendLog(job.id, {
            level: 'info',
            message,
            workerId: this.workerId,
            attempt: job.attempts,
            metadata,
          });
        },
      });

      if (!resume?.id) throw new Error('分析完成但未生成有效简历');
      await resumeAnalysisJobRepository.updateStatus(job.id, {
        status: 'succeeded',
        progress: 100,
        resumeId: resume.id,
        workerId: this.workerId,
        lockedAt: null,
        lastHeartbeatAt: new Date(),
        finishedAt: new Date(),
        errorCode: null,
        errorMessage: null,
      });
      await resumeAnalysisJobRepository.appendLog(job.id, {
        level: 'info',
        message: '任务分析成功，已生成简历',
        workerId: this.workerId,
        attempt: job.attempts,
        metadata: { resumeId: resume.id },
      });
    } catch (error) {
      await this.handleFailure(job, error);
    }
  }

  private async handleFailure(job: ResumeAnalysisJobRecord, error: unknown) {
    const latest = await resumeAnalysisJobRepository.findById(job.id);
    const attempts = latest?.attempts || job.attempts;
    const maxAttempts = latest?.maxAttempts || job.maxAttempts || 3;
    const retryable = attempts < maxAttempts;
    const parsedError = describeResumeAnalysisError(error);
    const code = error instanceof AIConfigError
      ? 'ai_config_error'
      : error instanceof AIUsageInsufficientCreditsError
        ? 'insufficient_credits'
        : parsedError.code;
    const message = userFacingFailure(error);

    await resumeAnalysisJobRepository.updateStatus(job.id, {
      status: retryable ? 'retrying' : 'failed',
      progress: retryable ? Math.max(latest?.progress || 0, 20) : 100,
      workerId: retryable ? null : this.workerId,
      lockedAt: null,
      lastHeartbeatAt: new Date(),
      nextRunAt: retryable ? nextRetryAt(attempts) : latest?.nextRunAt,
      finishedAt: retryable ? null : new Date(),
      errorCode: code,
      errorMessage: message,
    });

    await updateResumeAnalysisState(job, {
      status: retryable ? 'retrying' : 'failed',
      progress: retryable ? Math.max(latest?.progress || 0, 20) : 100,
      attempts,
      errorCode: code,
      errorMessage: message,
      message: retryable ? `分析失败，稍后自动重试（${attempts}/${maxAttempts}）。` : `分析失败：${message}`,
    });

    await resumeAnalysisJobRepository.appendLog(job.id, {
      level: retryable ? 'warn' : 'error',
      message: retryable
        ? `第 ${attempts} 次分析失败，稍后自动重试：${message}`
        : `已达到最大重试次数，任务失败：${message}`,
      workerId: this.workerId,
      attempt: attempts,
      metadata: {
        errorCode: code,
        rawError: errorMessage(error),
        details: parsedError.details,
        aiTrace: resumeAnalysisTrace(error),
        retryable,
        maxAttempts,
      },
    });
  }
}

export async function runResumeAnalysisWorker(options: ResumeAnalysisWorkerOptions = {}) {
  const worker = new ResumeAnalysisWorker(options);
  await worker.run();
}
