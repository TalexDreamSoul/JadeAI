import { and, desc, eq, like, or, sql } from 'drizzle-orm';
import { db } from '../index';
import { interviewSessions, jdAnalyses, jobApplications, resumes } from '../schema';
import type {
  JobApplicationResult,
  JobApplicationStage,
  JobApplicationWriteData,
} from '@/lib/career/job-application';

type JobApplicationListInput = {
  userId: string;
  page: number;
  pageSize: number;
  query?: string;
  stage?: JobApplicationStage;
  result?: JobApplicationResult;
};

function detailedSelection() {
  return {
    application: jobApplications,
    resume: {
      id: resumes.id,
      title: resumes.title,
      targetCompany: resumes.targetCompany,
      targetJobTitle: resumes.targetJobTitle,
    },
    jdAnalysis: {
      id: jdAnalyses.id,
      resumeId: jdAnalyses.resumeId,
      overallScore: jdAnalyses.overallScore,
      atsScore: jdAnalyses.atsScore,
      createdAt: jdAnalyses.createdAt,
    },
    interview: {
      id: interviewSessions.id,
      jobTitle: interviewSessions.jobTitle,
      status: interviewSessions.status,
      createdAt: interviewSessions.createdAt,
    },
  };
}

type DetailedRow = {
  application: typeof jobApplications.$inferSelect;
  resume: {
    id: string | null;
    title: string | null;
    targetCompany: string | null;
    targetJobTitle: string | null;
  } | null;
  jdAnalysis: {
    id: string | null;
    resumeId: string | null;
    overallScore: number | null;
    atsScore: number | null;
    createdAt: Date | null;
  } | null;
  interview: {
    id: string | null;
    jobTitle: string | null;
    status: string | null;
    createdAt: Date | null;
  } | null;
};

function mapDetailedRow(row: DetailedRow) {
  return {
    ...row.application,
    resume: row.resume?.id ? row.resume : null,
    jdAnalysis: row.jdAnalysis?.id ? row.jdAnalysis : null,
    interview: row.interview?.id ? row.interview : null,
  };
}

function listConditions(input: JobApplicationListInput) {
  const conditions = [eq(jobApplications.userId, input.userId)];
  if (input.stage) conditions.push(eq(jobApplications.stage, input.stage));
  if (input.result) conditions.push(eq(jobApplications.result, input.result));
  if (input.query) {
    const pattern = `%${input.query}%`;
    const queryCondition = or(
      like(jobApplications.companyName, pattern),
      like(jobApplications.jobTitle, pattern),
    );
    if (queryCondition) conditions.push(queryCondition);
  }
  return and(...conditions);
}

export const jobApplicationRepository = {
  async list(input: JobApplicationListInput) {
    const where = listConditions(input);
    const offset = (input.page - 1) * input.pageSize;
    const [rows, totalRows] = await Promise.all([
      db
        .select(detailedSelection())
        .from(jobApplications)
        .leftJoin(resumes, eq(jobApplications.resumeId, resumes.id))
        .leftJoin(jdAnalyses, eq(jobApplications.jdAnalysisId, jdAnalyses.id))
        .leftJoin(interviewSessions, eq(jobApplications.interviewSessionId, interviewSessions.id))
        .where(where)
        .orderBy(desc(jobApplications.updatedAt))
        .limit(input.pageSize)
        .offset(offset),
      db.select({ total: sql<number>`count(*)` }).from(jobApplications).where(where),
    ]);

    const total = Number(totalRows[0]?.total || 0);
    return {
      items: (rows as DetailedRow[]).map(mapDetailedRow),
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
    };
  },

  async findByIdForUser(id: string, userId: string) {
    const rows = await db
      .select(detailedSelection())
      .from(jobApplications)
      .leftJoin(resumes, eq(jobApplications.resumeId, resumes.id))
      .leftJoin(jdAnalyses, eq(jobApplications.jdAnalysisId, jdAnalyses.id))
      .leftJoin(interviewSessions, eq(jobApplications.interviewSessionId, interviewSessions.id))
      .where(and(eq(jobApplications.id, id), eq(jobApplications.userId, userId)))
      .limit(1);
    return rows[0] ? mapDetailedRow(rows[0] as DetailedRow) : null;
  },

  async create(userId: string, data: JobApplicationWriteData) {
    const id = crypto.randomUUID();
    await db.insert(jobApplications).values({
      id,
      userId,
      companyName: data.companyName!,
      jobTitle: data.jobTitle!,
      jobDescription: data.jobDescription || '',
      sourceUrl: data.sourceUrl ?? null,
      stage: data.stage || 'saved',
      result: data.result || 'pending',
      resumeId: data.resumeId ?? null,
      jdAnalysisId: data.jdAnalysisId ?? null,
      interviewSessionId: data.interviewSessionId ?? null,
      appliedAt: data.appliedAt ?? null,
      resultAt: data.resultAt ?? null,
      notes: data.notes || '',
    });
    return this.findByIdForUser(id, userId);
  },

  async update(id: string, userId: string, data: JobApplicationWriteData) {
    await db
      .update(jobApplications)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(jobApplications.id, id), eq(jobApplications.userId, userId)));
    return this.findByIdForUser(id, userId);
  },

  async delete(id: string, userId: string) {
    const existing = await this.findByIdForUser(id, userId);
    if (!existing) return false;
    await db
      .delete(jobApplications)
      .where(and(eq(jobApplications.id, id), eq(jobApplications.userId, userId)));
    return true;
  },
};
