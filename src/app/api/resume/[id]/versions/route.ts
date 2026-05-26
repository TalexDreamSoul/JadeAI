import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';

async function requireOwnedResume(request: NextRequest, id: string) {
  const user = await resolveUser(getUserIdFromRequest(request));
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const resume = await resumeRepository.findById(id);
  if (!resume) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  if (resume.userId !== user.id) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { user, resume };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requireOwnedResume(request, id);
  if (result.error) return result.error;
  return NextResponse.json(await resumeRepository.findVersions(id));
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
    const label = String(body.label || `v${new Date().toISOString()}`).trim();
    const version = await resumeRepository.createVersion(id, label, result.resume, 'manual');
    await resumeRepository.createEvent({
      resumeId: id,
      userId: result.user!.id,
      type: 'resume.version.created',
      title: 'Resume version saved',
      metadata: { label },
    });
    return NextResponse.json(version, { status: 201 });
  } catch (error) {
    console.error('POST /api/resume/[id]/versions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
function normalizeSnapshot(snapshot: unknown) {
  return snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
    ? snapshot as Record<string, unknown>
    : null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await requireOwnedResume(request, id);
    if (result.error) return result.error;

    const body = await request.json().catch(() => ({}));
    const versionId = String(body.versionId || '').trim();
    const action = String(body.action || 'restore').trim();
    if (!versionId) return NextResponse.json({ error: 'versionId is required' }, { status: 400 });

    const versions = await resumeRepository.findVersions(id);
    const version = versions.find((item: Awaited<ReturnType<typeof resumeRepository.findVersions>>[number]) => item.id === versionId);
    if (!version) return NextResponse.json({ error: 'Version not found' }, { status: 404 });

    const snapshot = normalizeSnapshot(version.snapshot);
    if (!snapshot) return NextResponse.json({ error: 'Invalid version snapshot' }, { status: 400 });

    if (action === 'duplicate') {
      const title = String(body.title || `${result.resume!.title} - ${version.label}`).trim();
      const copy = await resumeRepository.createFromSnapshot(snapshot, result.user!.id, title, {
        sourceResumeId: id,
        baseResumeId: result.resume!.baseResumeId || (result.resume!.isBase ? result.resume!.id : id),
        versionLabel: String(snapshot.versionLabel || version.label || 'copy'),
      });
      if (!copy) return NextResponse.json({ error: 'Duplicate failed' }, { status: 500 });
      const copyVersion = await resumeRepository.createVersion(copy.id, `copied-from-${version.label}`, copy, 'manual').catch(() => null);
      await resumeRepository.createEvent({
        resumeId: copy.id,
        userId: result.user!.id,
        type: 'resume.version.duplicated',
        title: 'Resume version duplicated',
        metadata: { sourceResumeId: id, versionId, label: version.label, copyVersionId: copyVersion?.id || null },
      }).catch(() => null);
      return NextResponse.json({ resume: copy, version, copyVersion }, { status: 201 });
    }

    await resumeRepository.createVersion(id, `restore-before-${new Date().toISOString()}`, result.resume, 'manual');
    const restored = await resumeRepository.restoreFromSnapshot(id, snapshot, {
      restoreMetadata: body.restoreMetadata !== false,
      restoreSections: body.restoreSections !== false,
    });
    if (!restored) return NextResponse.json({ error: 'Restore failed' }, { status: 500 });

    const afterVersion = await resumeRepository.createVersion(id, `restore-after-${version.label}`, restored, 'manual');
    await resumeRepository.createEvent({
      resumeId: id,
      userId: result.user!.id,
      type: 'resume.version.restored',
      title: 'Resume version restored',
      metadata: { versionId, label: version.label, afterVersionId: afterVersion?.id || null },
    });

    return NextResponse.json({ resume: restored, version, afterVersion });
  } catch (error) {
    console.error('PATCH /api/resume/[id]/versions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
