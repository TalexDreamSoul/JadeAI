import { NextRequest, NextResponse } from 'next/server';
import { resolveUser, getUserIdFromRequest } from '@/lib/auth/helpers';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import { analysisRepository } from '@/lib/db/repositories/analysis.repository';

type JdAnalysisRecord = Awaited<ReturnType<typeof analysisRepository.findJdAnalysisById>> & {
  resumeVersionId?: string | null;
  resumeVersionLabel?: string | null;
  resumeTitleSnapshot?: string | null;
  targetCompanySnapshot?: string | null;
  targetJobTitleSnapshot?: string | null;
  jdHash?: string | null;
  analysisGroupId?: string | null;
};

type ResumeMeta = {
  title: string;
  versionLabel: string;
  targetCompany: string | null;
  targetJobTitle: string | null;
  isCurrent: boolean;
  isBase: boolean;
};

export async function GET(request: NextRequest) {
  try {
    const fingerprint = getUserIdFromRequest(request);
    const user = await resolveUser(fingerprint);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resumeId = request.nextUrl.searchParams.get('resumeId');
    const id = request.nextUrl.searchParams.get('id');

    if (!resumeId) {
      return NextResponse.json({ error: 'resumeId is required' }, { status: 400 });
    }

    // Verify ownership
    const resume = await resumeRepository.findById(resumeId);
    if (!resume || resume.userId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const familyResumeIds = await resumeRepository.findFamilyIdsByResumeId(resumeId, user.id);
    const allowedResumeIds = familyResumeIds.length > 0 ? familyResumeIds : [resumeId];

    // Single record detail
    if (id) {
      const analysis = await analysisRepository.findJdAnalysisById(id);
      if (!analysis || !allowedResumeIds.includes(analysis.resumeId)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      return NextResponse.json({
        ...analysis,
        resumeVersionId: (analysis as JdAnalysisRecord).resumeVersionId || null,
        resumeVersionLabel: (analysis as JdAnalysisRecord).resumeVersionLabel || '',
        resumeTitleSnapshot: (analysis as JdAnalysisRecord).resumeTitleSnapshot || '',
        targetCompanySnapshot: (analysis as JdAnalysisRecord).targetCompanySnapshot || '',
        targetJobTitleSnapshot: (analysis as JdAnalysisRecord).targetJobTitleSnapshot || '',
        jdHash: (analysis as JdAnalysisRecord).jdHash || null,
        analysisGroupId: (analysis as JdAnalysisRecord).analysisGroupId || (analysis as JdAnalysisRecord).jdHash || null,
      });
    }

    // List all analyses in the same resume family so JD histories survive switching between base and derived JD resumes.
    const analyses = await analysisRepository.findJdAnalysesByResumeIds(allowedResumeIds);
    const familyResumes = await Promise.all(allowedResumeIds.map((id) => resumeRepository.findById(id).catch(() => null)));
    const resumeMeta = new Map<string, ResumeMeta>(familyResumes.filter(Boolean).map((item) => [item!.id, {
      title: item!.title,
      versionLabel: item!.versionLabel,
      targetCompany: item!.targetCompany,
      targetJobTitle: item!.targetJobTitle,
      isCurrent: item!.id === resumeId,
      isBase: item!.id === (resume.baseResumeId || resume.id),
    }]));

    const list = (analyses as JdAnalysisRecord[]).map((a) => {
      const meta = resumeMeta.get(a.resumeId);
      const resumeTitle = a.resumeTitleSnapshot || meta?.title || '';
      const resumeVersionLabel = a.resumeVersionLabel || meta?.versionLabel || '';
      const targetCompany = a.targetCompanySnapshot || meta?.targetCompany || '';
      const targetJobTitle = a.targetJobTitleSnapshot || meta?.targetJobTitle || '';
      return {
        id: a.id,
        resumeId: a.resumeId,
        resumeVersionId: a.resumeVersionId || null,
        resumeTitle,
        resumeVersionLabel,
        targetCompany,
        targetJobTitle,
        jdHash: a.jdHash || null,
        analysisGroupId: a.analysisGroupId || a.jdHash || null,
        isCurrentResume: meta?.isCurrent || false,
        isBaseResume: meta?.isBase || false,
        overallScore: a.overallScore,
        atsScore: a.atsScore,
        jobDescription: a.jobDescription,
        jobDescriptionPreview: a.jobDescription.slice(0, 140),
        status: a.status || 'success',
        error: a.error || undefined,
        createdAt: a.createdAt,
      };
    });

    return NextResponse.json(list);
  } catch (error) {
    console.error('GET /api/ai/jd-analysis/history error:', error);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const fingerprint = getUserIdFromRequest(request);
    const user = await resolveUser(fingerprint);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Verify ownership via the analysis record
    const analysis = await analysisRepository.findJdAnalysisById(id);
    if (!analysis) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const resume = await resumeRepository.findById(analysis.resumeId);
    if (!resume || resume.userId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await analysisRepository.deleteJdAnalysis(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/ai/jd-analysis/history error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
