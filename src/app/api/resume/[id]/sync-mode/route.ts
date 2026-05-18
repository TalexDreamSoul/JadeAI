import { NextRequest, NextResponse } from 'next/server';
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

async function requireOwnedResume(request: NextRequest, id: string) {
  const user = await resolveUser(getUserIdFromRequest(request));
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const resume = await resumeRepository.findById(id);
  if (!resume) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  if (resume.userId !== user.id) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { user, resume };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await requireOwnedResume(request, id);
    if (result.error) return result.error;

    const body = await request.json().catch(() => ({}));
    const mode = String(body.mode || '');

    if (mode === 'local') {
      await resumeRepository.purgeCloudDataForLocalOnly(id);
      const updated = await resumeRepository.findById(id);
      return NextResponse.json({ ...updated, localOnly: true });
    }

    if (mode === 'cloud') {
      const title = typeof body.title === 'string' ? body.title : result.resume!.title;
      const template = typeof body.template === 'string' ? body.template : result.resume!.template;
      const language = typeof body.language === 'string' ? body.language : result.resume!.language;
      const sections = Array.isArray(body.sections) ? body.sections as SectionInput[] : [];

      await resumeRepository.update(id, {
        cloudSyncEnabled: true,
        title,
        template,
        language,
        ...(body.themeConfig !== undefined ? { themeConfig: body.themeConfig } : {}),
        ...(body.isBase !== undefined ? { isBase: !!body.isBase } : {}),
        ...(body.baseResumeId !== undefined ? { baseResumeId: body.baseResumeId } : {}),
        ...(body.targetCompany !== undefined ? { targetCompany: body.targetCompany } : {}),
        ...(body.targetJobTitle !== undefined ? { targetJobTitle: body.targetJobTitle } : {}),
        ...(body.jobDescription !== undefined ? { jobDescription: body.jobDescription } : {}),
        ...(body.versionLabel !== undefined ? { versionLabel: body.versionLabel } : {}),
      });

      const existingSections = (result.resume!.sections || []) as Array<{ id: string }>;
      for (const existing of existingSections) {
        await resumeRepository.deleteSection(existing.id);
      }
      for (let i = 0; i < sections.length; i += 1) {
        const section = sections[i];
        await resumeRepository.createSection({
          id: section.id,
          resumeId: id,
          type: section.type,
          title: section.title,
          sortOrder: typeof section.sortOrder === 'number' ? section.sortOrder : i,
          visible: section.visible,
          content: section.content,
        });
      }

      const updated = await resumeRepository.findById(id);
      if (updated) {
        await resumeRepository.createVersion(id, body.versionLabel || `v${new Date().toISOString()}`, updated, 'manual').catch(() => null);
        await resumeRepository.createEvent({
          resumeId: id,
          userId: result.user!.id,
          type: 'resume.cloud.enabled',
          title: 'Cloud sync enabled',
          metadata: { fromLocalOnly: true },
        }).catch(() => null);
      }
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  } catch (error) {
    console.error('POST /api/resume/[id]/sync-mode error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
