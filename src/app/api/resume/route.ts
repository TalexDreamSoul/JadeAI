import { NextRequest, NextResponse } from 'next/server';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import { resumeAnalysisJobRepository } from '@/lib/db/repositories/resume-analysis-job.repository';
import { resolveUser, getUserIdFromRequest } from '@/lib/auth/helpers';
import { DEFAULT_SECTIONS, DEFAULT_TEMPLATE } from '@/lib/constants';
import {
  assertCanCreateResume,
  commercialFeatureLockedResponse,
  CommercialFeatureLockedError,
} from '@/lib/commercial/feature-gate-service';

export async function GET(request: NextRequest) {
  try {
    const fingerprint = getUserIdFromRequest(request);
    const user = await resolveUser(fingerprint);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await assertCanCreateResume(user.id, Number(user.aiCredits || 0));

    const resumes = await resumeRepository.findAllByUserId(user.id);
    const jobs = await resumeAnalysisJobRepository.listForUser(user.id, 100);
    type AnalysisJob = Awaited<ReturnType<typeof resumeAnalysisJobRepository.listForUser>>[number];
    type UserResume = Awaited<ReturnType<typeof resumeRepository.findAllByUserId>>[number];
    const jobsByResumeId = new Map<string, AnalysisJob>();
    for (const job of jobs) {
      if (job.resumeId) jobsByResumeId.set(job.resumeId, job);
    }
    const enriched = await Promise.all(resumes.map(async (resume: UserResume) => {
      const job = jobsByResumeId.get(resume.id);
      if (!job) return resume;
      const position = await resumeAnalysisJobRepository.getQueuePosition(job);
      const themeConfig = resume.themeConfig && typeof resume.themeConfig === 'object' && !Array.isArray(resume.themeConfig)
        ? resume.themeConfig as Record<string, unknown>
        : {};
      return {
        ...resume,
        themeConfig: {
          ...themeConfig,
          analysisJob: {
            id: job.id,
            status: job.status,
            progress: job.progress,
            position,
            attempts: job.attempts,
            maxAttempts: job.maxAttempts,
            errorCode: job.errorCode,
            errorMessage: job.errorMessage,
            workerId: job.workerId,
            updatedAt: job.updatedAt,
            finishedAt: job.finishedAt,
          },
        },
      };
    }));
    return NextResponse.json(enriched);
  } catch (error) {
    console.error('GET /api/resume error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const fingerprint = getUserIdFromRequest(request);
    const user = await resolveUser(fingerprint);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      template,
      language,
      sections,
      themeConfig,
      isBase,
      cloudSyncEnabled,
      baseResumeId,
      targetCompany,
      targetJobTitle,
      jobDescription,
      versionLabel,
    } = body;

    const resume = await resumeRepository.create({
      userId: user.id,
      title: title || '未命名简历',
      template: template || DEFAULT_TEMPLATE,
      language: language || 'zh',
      ...(themeConfig ? { themeConfig } : {}),
      ...(isBase !== undefined ? { isBase } : {}),
      ...(cloudSyncEnabled !== undefined ? { cloudSyncEnabled } : {}),
      ...(baseResumeId !== undefined ? { baseResumeId } : {}),
      ...(targetCompany !== undefined ? { targetCompany } : {}),
      ...(targetJobTitle !== undefined ? { targetJobTitle } : {}),
      ...(jobDescription !== undefined ? { jobDescription } : {}),
      ...(versionLabel !== undefined ? { versionLabel } : {}),
    });

    if (resume) {
      if (Array.isArray(sections) && sections.length > 0) {
        // Import mode: use provided sections, ignore original ids
        for (let i = 0; i < sections.length; i++) {
          const s = sections[i];
          await resumeRepository.createSection({
            resumeId: resume.id,
            type: s.type,
            title: s.title,
            sortOrder: i,
            visible: s.visible,
            content: s.content,
          });
        }
      } else {
        // Default mode: create empty sections
        const lang = resume.language || 'zh';
        for (let i = 0; i < DEFAULT_SECTIONS.length; i++) {
          const s = DEFAULT_SECTIONS[i];
          const sectionTitle = lang === 'en' ? s.titleEn : s.titleZh;
          let content: unknown = {};

          if (s.type === 'personal_info') {
            content = { fullName: '', jobTitle: '', email: '', phone: '', location: '' };
          } else if (s.type === 'summary') {
            content = { text: '' };
          } else if (s.type === 'work_experience' || s.type === 'education' || s.type === 'projects' || s.type === 'certifications' || s.type === 'languages' || s.type === 'github' || s.type === 'custom') {
            content = { items: [] };
          } else if (s.type === 'skills') {
            content = { categories: [] };
          }

          await resumeRepository.createSection({
            resumeId: resume.id,
            type: s.type,
            title: sectionTitle,
            sortOrder: i,
            content,
          });
        }
      }

      const fullResume = await resumeRepository.findById(resume.id);
      return NextResponse.json(fullResume, { status: 201 });
    }

    return NextResponse.json({ error: 'Failed to create resume' }, { status: 500 });
  } catch (error) {
    if (error instanceof CommercialFeatureLockedError) {
      return commercialFeatureLockedResponse(error);
    }
    console.error('POST /api/resume error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
