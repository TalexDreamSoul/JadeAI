import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_SECTIONS, DEFAULT_TEMPLATE } from '@/lib/constants';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';

type SectionInput = {
  id?: string;
  type: string;
  title: string;
  sortOrder?: number;
  visible?: boolean;
  content?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const sections = Array.isArray(body.sections) ? body.sections as SectionInput[] : [];
    const resume = await resumeRepository.create({
      userId: user.id,
      title: typeof body.title === 'string' && body.title.trim() ? body.title.trim() : '未命名简历',
      template: typeof body.template === 'string' ? body.template : DEFAULT_TEMPLATE,
      language: typeof body.language === 'string' ? body.language : 'zh',
      cloudSyncEnabled: true,
      ...(body.themeConfig !== undefined ? { themeConfig: body.themeConfig } : {}),
      ...(body.isBase !== undefined ? { isBase: !!body.isBase } : {}),
      ...(body.baseResumeId !== undefined ? { baseResumeId: body.baseResumeId } : {}),
      ...(body.targetCompany !== undefined ? { targetCompany: body.targetCompany } : {}),
      ...(body.targetJobTitle !== undefined ? { targetJobTitle: body.targetJobTitle } : {}),
      ...(body.jobDescription !== undefined ? { jobDescription: body.jobDescription } : {}),
      ...(body.versionLabel !== undefined ? { versionLabel: body.versionLabel } : {}),
    });

    if (!resume) return NextResponse.json({ error: 'Failed to create resume' }, { status: 500 });

    if (sections.length > 0) {
      for (let i = 0; i < sections.length; i += 1) {
        const section = sections[i];
        await resumeRepository.createSection({
          resumeId: resume.id,
          type: section.type,
          title: section.title,
          sortOrder: typeof section.sortOrder === 'number' ? section.sortOrder : i,
          visible: section.visible,
          content: section.content,
        });
      }
    } else {
      const language = typeof body.language === 'string' ? body.language : 'zh';
      for (let i = 0; i < DEFAULT_SECTIONS.length; i += 1) {
        const section = DEFAULT_SECTIONS[i];
        await resumeRepository.createSection({
          resumeId: resume.id,
          type: section.type,
          title: language === 'en' ? section.titleEn : section.titleZh,
          sortOrder: i,
          content: section.type === 'personal_info'
            ? { fullName: '', jobTitle: '', email: '', phone: '', location: '' }
            : section.type === 'summary'
              ? { text: '' }
              : section.type === 'skills'
                ? { categories: [] }
                : { items: [] },
        });
      }
    }

    const fullResume = await resumeRepository.findById(resume.id);
    if (fullResume) {
      await resumeRepository.createVersion(fullResume.id, body.versionLabel || 'uploaded-local', fullResume, 'manual').catch(() => null);
      await resumeRepository.createEvent({
        resumeId: fullResume.id,
        userId: user.id,
        type: 'resume.local.uploaded',
        title: 'Local resume uploaded',
        metadata: { sourceLocalId: typeof body.id === 'string' ? body.id : null },
      }).catch(() => null);
    }

    return NextResponse.json(fullResume, { status: 201 });
  } catch (error) {
    console.error('POST /api/resume/upload-local error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
