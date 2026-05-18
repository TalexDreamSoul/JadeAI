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
