import { and, asc, count, desc, eq, inArray, isNull, lt, lte, or } from 'drizzle-orm';
import { db } from '../index';
import { resumeAnalysisJobs, users } from '../schema';

export type ResumeAnalysisJobStatus = 'queued' | 'running' | 'retrying' | 'succeeded' | 'failed';
export type ResumeAnalysisLogLevel = 'info' | 'warn' | 'error';

export type ResumeAnalysisJobLog = {
  at: string;
  level: ResumeAnalysisLogLevel;
  message: string;
  workerId?: string | null;
  attempt?: number;
  metadata?: Record<string, unknown>;
};

export type ResumeAnalysisJobRecord = typeof resumeAnalysisJobs.$inferSelect;

type CreateJobInput = {
  userId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileData: string;
  template: string;
  language: string;
  metadata?: Record<string, unknown>;
};

const ACTIVE_STATUSES: ResumeAnalysisJobStatus[] = ['queued', 'running', 'retrying'];

function now() {
  return new Date();
}

function normalizeLogs(value: unknown): ResumeAnalysisJobLog[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as ResumeAnalysisJobLog[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed as ResumeAnalysisJobLog[] : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toPublicJob(job: ResumeAnalysisJobRecord | null) {
  if (!job) return null;
  return Object.fromEntries(
    Object.entries(job).filter(([key]) => key !== 'fileData'),
  ) as Omit<ResumeAnalysisJobRecord, 'fileData'>;
}

export const resumeAnalysisJobRepository = {
  activeStatuses: ACTIVE_STATUSES,

  toPublicJob,

  async countActiveByUserId(userId: string) {
    const rows = await db
      .select({ value: count() })
      .from(resumeAnalysisJobs)
      .where(and(eq(resumeAnalysisJobs.userId, userId), inArray(resumeAnalysisJobs.status, ACTIVE_STATUSES)));
    return Number(rows[0]?.value || 0);
  },

  async create(data: CreateJobInput) {
    const id = crypto.randomUUID();
    const activeCount = await this.countActiveByUserId(data.userId);
    const initialLog: ResumeAnalysisJobLog = {
      at: new Date().toISOString(),
      level: 'info',
      message: '任务已创建，等待后台分析',
      metadata: { fileName: data.fileName, fileType: data.fileType, fileSize: data.fileSize },
    };

    await db.insert(resumeAnalysisJobs).values({
      id,
      userId: data.userId,
      fileName: data.fileName,
      fileType: data.fileType,
      fileSize: data.fileSize,
      fileData: data.fileData,
      template: data.template,
      language: data.language,
      position: activeCount + 1,
      logs: [initialLog],
      metadata: data.metadata || {},
    });
    return this.findById(id);
  },

  async findById(id: string) {
    const rows = await db.select().from(resumeAnalysisJobs).where(eq(resumeAnalysisJobs.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async findByIdForUser(id: string, userId: string) {
    const rows = await db
      .select()
      .from(resumeAnalysisJobs)
      .where(and(eq(resumeAnalysisJobs.id, id), eq(resumeAnalysisJobs.userId, userId)))
      .limit(1);
    return rows[0] ?? null;
  },

  async listForUser(userId: string, limit = 20) {
    return db
      .select()
      .from(resumeAnalysisJobs)
      .where(eq(resumeAnalysisJobs.userId, userId))
      .orderBy(desc(resumeAnalysisJobs.createdAt))
      .limit(limit);
  },

  async listAll(input: { limit?: number; status?: string; userId?: string; workerId?: string } = {}) {
    const conditions = [];
    if (input.status && input.status !== 'all') conditions.push(eq(resumeAnalysisJobs.status, input.status as ResumeAnalysisJobStatus));
    if (input.userId) conditions.push(eq(resumeAnalysisJobs.userId, input.userId));
    if (input.workerId) conditions.push(eq(resumeAnalysisJobs.workerId, input.workerId));

    const baseQuery = db
      .select({
        job: resumeAnalysisJobs,
        user: {
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
        },
      })
      .from(resumeAnalysisJobs)
      .leftJoin(users, eq(resumeAnalysisJobs.userId, users.id));

    const rows = conditions.length
      ? await baseQuery.where(and(...conditions)).orderBy(desc(resumeAnalysisJobs.createdAt)).limit(input.limit || 100)
      : await baseQuery.orderBy(desc(resumeAnalysisJobs.createdAt)).limit(input.limit || 100);

    return rows.map((row: {
      job: ResumeAnalysisJobRecord;
      user: { id: string | null; email: string | null; name: string | null; role: string | null } | null;
    }) => ({
      ...toPublicJob(row.job),
      user: row.user?.id ? row.user : null,
    }));
  },

  async appendLog(id: string, log: Omit<ResumeAnalysisJobLog, 'at'>) {
    const job = await this.findById(id);
    if (!job) return null;
    const logs = normalizeLogs(job.logs).concat({ ...log, at: new Date().toISOString() }).slice(-200);
    await db.update(resumeAnalysisJobs).set({ logs, updatedAt: now() }).where(eq(resumeAnalysisJobs.id, id));
    return this.findById(id);
  },

  async updateStatus(id: string, data: {
    status?: ResumeAnalysisJobStatus;
    progress?: number;
    resumeId?: string | null;
    workerId?: string | null;
    attempts?: number;
    errorCode?: string | null;
    errorMessage?: string | null;
    nextRunAt?: Date;
    startedAt?: Date | null;
    finishedAt?: Date | null;
    lockedAt?: Date | null;
    lastHeartbeatAt?: Date | null;
  }) {
    await db.update(resumeAnalysisJobs).set({
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.progress !== undefined ? { progress: data.progress } : {}),
      ...(data.resumeId !== undefined ? { resumeId: data.resumeId } : {}),
      ...(data.workerId !== undefined ? { workerId: data.workerId } : {}),
      ...(data.attempts !== undefined ? { attempts: data.attempts } : {}),
      ...(data.errorCode !== undefined ? { errorCode: data.errorCode } : {}),
      ...(data.errorMessage !== undefined ? { errorMessage: data.errorMessage } : {}),
      ...(data.nextRunAt !== undefined ? { nextRunAt: data.nextRunAt } : {}),
      ...(data.startedAt !== undefined ? { startedAt: data.startedAt } : {}),
      ...(data.finishedAt !== undefined ? { finishedAt: data.finishedAt } : {}),
      ...(data.lockedAt !== undefined ? { lockedAt: data.lockedAt } : {}),
      ...(data.lastHeartbeatAt !== undefined ? { lastHeartbeatAt: data.lastHeartbeatAt } : {}),
      updatedAt: now(),
    }).where(eq(resumeAnalysisJobs.id, id));
    return this.findById(id);
  },

  async heartbeat(id: string, workerId: string) {
    return this.updateStatus(id, { workerId, lastHeartbeatAt: now() });
  },

  async releaseStaleRunningJobs(staleBefore: Date) {
    const staleJobs = await db
      .select()
      .from(resumeAnalysisJobs)
      .where(and(eq(resumeAnalysisJobs.status, 'running'), or(isNull(resumeAnalysisJobs.lastHeartbeatAt), lte(resumeAnalysisJobs.lastHeartbeatAt, staleBefore))));

    for (const job of staleJobs) {
      const nextAttempts = job.attempts;
      const retryable = nextAttempts < job.maxAttempts;
      await this.updateStatus(job.id, {
        status: retryable ? 'retrying' : 'failed',
        progress: retryable ? job.progress : 100,
        workerId: null,
        lockedAt: null,
        nextRunAt: retryable ? now() : job.nextRunAt,
        finishedAt: retryable ? null : now(),
        errorCode: 'worker_stale',
        errorMessage: retryable ? '后台 worker 心跳超时，任务已重新排队' : '后台 worker 心跳超时，任务失败',
      });
      await this.appendLog(job.id, {
        level: retryable ? 'warn' : 'error',
        message: retryable ? '检测到 worker 心跳超时，任务进入重试队列' : '检测到 worker 心跳超时，任务已失败',
        workerId: job.workerId,
        attempt: job.attempts,
      });
    }

    return staleJobs.length;
  },

  async claimNext(workerId: string) {
    const nowDate = now();
    const candidates = await db
      .select()
      .from(resumeAnalysisJobs)
      .where(and(
        inArray(resumeAnalysisJobs.status, ['queued', 'retrying']),
        lte(resumeAnalysisJobs.nextRunAt, nowDate),
      ))
      .orderBy(asc(resumeAnalysisJobs.createdAt))
      .limit(50);

    for (const candidate of candidates) {
      const earlierActive = await db.select({ id: resumeAnalysisJobs.id }).from(resumeAnalysisJobs).where(and(
        eq(resumeAnalysisJobs.userId, candidate.userId),
        inArray(resumeAnalysisJobs.status, ACTIVE_STATUSES),
        lt(resumeAnalysisJobs.createdAt, candidate.createdAt),
      )).orderBy(asc(resumeAnalysisJobs.createdAt)).limit(1);
      if (earlierActive.length) continue;

      const runningSameUser = await db.select({ id: resumeAnalysisJobs.id }).from(resumeAnalysisJobs).where(and(
        eq(resumeAnalysisJobs.userId, candidate.userId),
        eq(resumeAnalysisJobs.status, 'running'),
      )).limit(1);
      if (runningSameUser.length) continue;

      await db.update(resumeAnalysisJobs).set({
        status: 'running',
        workerId,
        lockedAt: nowDate,
        lastHeartbeatAt: nowDate,
        startedAt: candidate.startedAt || nowDate,
        attempts: candidate.attempts + 1,
        progress: Math.max(candidate.progress || 0, 10),
        updatedAt: nowDate,
      }).where(and(eq(resumeAnalysisJobs.id, candidate.id), inArray(resumeAnalysisJobs.status, ['queued', 'retrying'])));

      const claimed = await this.findById(candidate.id);
      if (claimed?.status === 'running' && claimed.workerId === workerId) {
        await this.appendLog(candidate.id, {
          level: 'info',
          message: 'worker 已领取任务',
          workerId,
          attempt: claimed.attempts,
        });
        return claimed;
      }
    }

    return null;
  },

  async getQueuePosition(job: ResumeAnalysisJobRecord) {
    if (!ACTIVE_STATUSES.includes(job.status as ResumeAnalysisJobStatus)) return 0;
    const rows = await db
      .select({ value: count() })
      .from(resumeAnalysisJobs)
      .where(and(
        eq(resumeAnalysisJobs.userId, job.userId),
        inArray(resumeAnalysisJobs.status, ACTIVE_STATUSES),
        lte(resumeAnalysisJobs.createdAt, job.createdAt),
      ));
    return Number(rows[0]?.value || 0);
  },
};
