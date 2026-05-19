import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { userProfileMemoryRepository } from '@/lib/db/repositories/user-profile-memory.repository';

const ALLOWED_TYPES = new Set(['profile', 'preference', 'project_fact', 'skill_evidence', 'interview_gap']);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const update: Record<string, unknown> = {};

    if (body.type !== undefined) {
      const type = String(body.type);
      if (ALLOWED_TYPES.has(type)) update.type = type;
    }
    if (body.title !== undefined) update.title = String(body.title).trim();
    if (body.content !== undefined) update.content = String(body.content).trim();
    if (body.source !== undefined) update.source = String(body.source).trim() || 'manual';
    if (typeof body.confidence === 'number') update.confidence = Math.max(0, Math.min(100, Math.round(body.confidence)));
    if (body.metadata !== undefined) update.metadata = body.metadata;

    if (update.title === '') {
      return NextResponse.json({ error: 'Memory title is required' }, { status: 400 });
    }

    const memory = await userProfileMemoryRepository.update(id, user.id, update);
    return NextResponse.json(memory);
  } catch (error) {
    console.error('PATCH /api/career/memories/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    await userProfileMemoryRepository.delete(id, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/career/memories/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
