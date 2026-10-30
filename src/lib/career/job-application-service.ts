import { analysisRepository } from '@/lib/db/repositories/analysis.repository';
import { interviewRepository } from '@/lib/db/repositories/interview.repository';
import { jobApplicationRepository } from '@/lib/db/repositories/job-application.repository';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import type { JobApplicationWriteData } from './job-application';
import { recordProductEventSafely } from '@/lib/analytics/product-event-service';

export class InvalidJobApplicationRelationError extends Error {
  constructor(relation: string) {
    super(`Invalid ${relation}`);
    this.name = 'InvalidJobApplicationRelationError';
  }
}

export async function assertOwnedApplicationRelations(userId: string, data: JobApplicationWriteData) {
  if (data.resumeId) {
    const resume = await resumeRepository.findById(data.resumeId);
    if (!resume || resume.userId !== userId) throw new InvalidJobApplicationRelationError('resume');
  }

  if (data.jdAnalysisId) {
    const analysis = await analysisRepository.findJdAnalysisById(data.jdAnalysisId);
    const resume = analysis ? await resumeRepository.findById(analysis.resumeId) : null;
    if (!analysis || !resume || resume.userId !== userId) {
      throw new InvalidJobApplicationRelationError('JD analysis');
    }
  }

  if (data.interviewSessionId) {
    const session = await interviewRepository.findSession(data.interviewSessionId);
    if (!session || session.userId !== userId) throw new InvalidJobApplicationRelationError('interview');
  }
}

export async function createJobApplication(userId: string, data: JobApplicationWriteData) {
  await assertOwnedApplicationRelations(userId, data);
  const application = await jobApplicationRepository.create(userId, data);
  if (application) {
    await recordProductEventSafely({
      eventName: 'application_created',
      userId,
      metadata: {
        applicationId: application.id,
        stage: application.stage,
        hasResume: !!application.resumeId,
        hasJdAnalysis: !!application.jdAnalysisId,
        hasInterview: !!application.interviewSessionId,
      },
    });
    if (application.result !== 'pending') {
      await recordProductEventSafely({
        eventName: 'application_result_recorded',
        userId,
        metadata: {
          applicationId: application.id,
          stage: application.stage,
          result: application.result,
        },
      });
    }
  }
  return application;
}

export async function updateJobApplication(id: string, userId: string, data: JobApplicationWriteData) {
  const existing = await jobApplicationRepository.findByIdForUser(id, userId);
  if (!existing) return null;
  await assertOwnedApplicationRelations(userId, data);
  const application = await jobApplicationRepository.update(id, userId, data);
  if (
    application
    && application.result !== 'pending'
    && application.result !== existing.result
  ) {
    await recordProductEventSafely({
      eventName: 'application_result_recorded',
      userId,
      metadata: {
        applicationId: application.id,
        stage: application.stage,
        result: application.result,
      },
    });
  }
  return application;
}

export async function listJobApplicationOptions(userId: string) {
  type ResumeOptionRow = {
    id: string;
    title: string;
    targetCompany: string | null;
    targetJobTitle: string | null;
    jobDescription: string | null;
  };
  type JdAnalysisOptionRow = {
    id: string;
    resumeId: string;
    targetCompanySnapshot: string | null;
    targetJobTitleSnapshot: string | null;
    jobDescription: string;
    overallScore: number;
    createdAt: Date;
  };
  type InterviewOptionRow = {
    id: string;
    resumeId: string | null;
    jobTitle: string;
    status: string;
    createdAt: Date;
  };

  const resumes = await resumeRepository.findAllByUserId(userId) as ResumeOptionRow[];
  const resumeIds = resumes.map((resume: ResumeOptionRow) => resume.id);
  const [rawJdAnalyses, rawInterviews] = await Promise.all([
    analysisRepository.findJdAnalysesByResumeIds(resumeIds, 100),
    interviewRepository.findSessionsByUserId(userId),
  ]);
  const jdAnalyses = rawJdAnalyses as JdAnalysisOptionRow[];
  const interviews = rawInterviews as InterviewOptionRow[];
  const resumeById = new Map(resumes.map((resume: ResumeOptionRow) => [resume.id, resume]));

  return {
    resumes: resumes.slice(0, 100).map((resume: ResumeOptionRow) => ({
      id: resume.id,
      title: resume.title,
      targetCompany: resume.targetCompany,
      targetJobTitle: resume.targetJobTitle,
      jobDescription: resume.jobDescription,
    })),
    jdAnalyses: jdAnalyses.map((analysis: JdAnalysisOptionRow) => ({
      id: analysis.id,
      resumeId: analysis.resumeId,
      resumeTitle: resumeById.get(analysis.resumeId)?.title || '',
      companyName: analysis.targetCompanySnapshot,
      jobTitle: analysis.targetJobTitleSnapshot,
      jobDescription: analysis.jobDescription,
      overallScore: analysis.overallScore,
      createdAt: analysis.createdAt,
    })),
    interviews: interviews.slice(0, 100).map((session: InterviewOptionRow) => ({
      id: session.id,
      resumeId: session.resumeId,
      jobTitle: session.jobTitle,
      status: session.status,
      createdAt: session.createdAt,
    })),
  };
}
