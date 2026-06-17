import { NextRequest, NextResponse } from 'next/server';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import { resolveUser, getUserIdFromRequest } from '@/lib/auth/helpers';
import { storeDataUrlObject } from '@/lib/storage/object-storage';

type ResumeSectionInput = {
  id: string;
  type: string;
  title: string;
  sortOrder: number;
  visible?: boolean;
  content?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function storeSectionAvatarIfNeeded(input: {
  userId: string;
  resumeId: string;
  section: ResumeSectionInput;
}): Promise<ResumeSectionInput> {
  if (input.section.type !== 'personal_info') return input.section;
  const content = asRecord(input.section.content);
  const avatar = content.avatar;
  if (typeof avatar !== 'string' || !avatar.startsWith('data:image/')) return input.section;

  try {
    const storedAvatar = await storeDataUrlObject({
      key: `resume-avatar/${input.userId}/${input.resumeId}/${crypto.randomUUID()}`,
      dataUrl: avatar,
      fileNameBase: 'resume-avatar',
    });
    if (!storedAvatar?.url || storedAvatar.publicRead === false) return input.section;
    return {
      ...input.section,
      content: {
        ...content,
        avatar: storedAvatar.url,
      },
    };
  } catch (error) {
    console.warn('Qiniu upload failed for resume avatar; keeping data URL:', error);
    return input.section;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const fingerprint = getUserIdFromRequest(request);
    const user = await resolveUser(fingerprint);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resume = await resumeRepository.findById(id);
    if (!resume) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (resume.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(resume);
  } catch (error) {
    console.error('GET /api/resume/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const fingerprint = getUserIdFromRequest(request);
    const user = await resolveUser(fingerprint);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resume = await resumeRepository.findById(id);
    if (!resume) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (resume.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const beforeUpdate = resume;
    const body = await request.json();
    const {
      title,
      template,
      themeConfig,
      language,
      sections,
      isBase,
      cloudSyncEnabled,
      baseResumeId,
      targetCompany,
      targetJobTitle,
      jobDescription,
      versionLabel,
    } = body;

    if (resume.cloudSyncEnabled === false || cloudSyncEnabled === false) {
      await resumeRepository.update(id, {
        cloudSyncEnabled: false,
        ...(title !== undefined ? { title } : {}),
        ...(isBase !== undefined ? { isBase } : {}),
        ...(baseResumeId !== undefined ? { baseResumeId } : {}),
        ...(targetCompany !== undefined ? { targetCompany } : {}),
        ...(targetJobTitle !== undefined ? { targetJobTitle } : {}),
        ...(jobDescription !== undefined ? { jobDescription } : {}),
        ...(versionLabel !== undefined ? { versionLabel } : {}),
      });
      const updated = await resumeRepository.findById(id);
      return NextResponse.json({
        ...updated,
        localOnly: true,
        message: 'Cloud sync is disabled for this resume. Content changes stay in the browser draft.',
      });
    }

    // Update resume metadata
    if (
      title !== undefined ||
      template !== undefined ||
      themeConfig !== undefined ||
      language !== undefined ||
      isBase !== undefined ||
      cloudSyncEnabled !== undefined ||
      baseResumeId !== undefined ||
      targetCompany !== undefined ||
      targetJobTitle !== undefined ||
      jobDescription !== undefined ||
      versionLabel !== undefined
    ) {
      await resumeRepository.update(id, {
        ...(title !== undefined ? { title } : {}),
        ...(template !== undefined ? { template } : {}),
        ...(themeConfig !== undefined ? { themeConfig } : {}),
        ...(language !== undefined ? { language } : {}),
        ...(isBase !== undefined ? { isBase } : {}),
        ...(cloudSyncEnabled !== undefined ? { cloudSyncEnabled } : {}),
        ...(baseResumeId !== undefined ? { baseResumeId } : {}),
        ...(targetCompany !== undefined ? { targetCompany } : {}),
        ...(targetJobTitle !== undefined ? { targetJobTitle } : {}),
        ...(jobDescription !== undefined ? { jobDescription } : {}),
        ...(versionLabel !== undefined ? { versionLabel } : {}),
      });
    }

    // Sync sections: create new, update existing, delete removed
    if (sections && Array.isArray(sections)) {
      const existingSections = (resume.sections || []) as ResumeSectionInput[];
      const typedSections = await Promise.all((sections as ResumeSectionInput[]).map((section) => storeSectionAvatarIfNeeded({
        userId: user.id,
        resumeId: id,
        section,
      })));
      const existingIds = new Set(existingSections.map((s) => s.id));
      const incomingIds = new Set(typedSections.map((s) => s.id));

      // Delete sections that were removed by the user
      for (const existing of existingSections) {
        if (!incomingIds.has(existing.id)) {
          await resumeRepository.deleteSection(existing.id);
        }
      }

      for (const section of typedSections) {
        if (existingIds.has(section.id)) {
          // Update existing section
          await resumeRepository.updateSection(section.id, {
            title: section.title,
            sortOrder: section.sortOrder,
            visible: section.visible,
            content: section.content,
          });
        } else {
          // Create new section added by the user
          await resumeRepository.createSection({
            id: section.id,
            resumeId: id,
            type: section.type,
            title: section.title,
            sortOrder: section.sortOrder,
            visible: section.visible,
            content: section.content,
          });
        }
      }
    }

    const updated = await resumeRepository.findById(id);
    if (updated) {
      const now = new Date().toISOString();
      const labelBase = versionLabel || `autosave-${now}`;
      await resumeRepository.createVersion(
        id,
        `${labelBase}-before`,
        beforeUpdate,
        'autosave'
      ).catch(() => null);
      await resumeRepository.createVersion(
        id,
        `${labelBase}-after`,
        updated,
        'autosave'
      ).catch(() => null);
      await resumeRepository.createEvent({
        resumeId: id,
        userId: user.id,
        type: 'resume.updated',
        title: 'Resume updated',
        metadata: { versionLabel: versionLabel || updated.versionLabel || null },
      }).catch(() => null);
    }
    return NextResponse.json(updated);
  } catch (error) {
    console.error('PUT /api/resume/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const fingerprint = getUserIdFromRequest(request);
    const user = await resolveUser(fingerprint);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resume = await resumeRepository.findById(id);
    if (!resume) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (resume.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await resumeRepository.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/resume/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
