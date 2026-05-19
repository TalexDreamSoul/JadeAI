import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { userProfileMemoryRepository } from '@/lib/db/repositories/user-profile-memory.repository';

const ALLOWED_TYPES = new Set(['profile', 'preference', 'project_fact', 'skill_evidence', 'interview_gap']);

export async function GET(request: NextRequest) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const type = request.nextUrl.searchParams.get('type');
    const memories = type && ALLOWED_TYPES.has(type)
      ? await userProfileMemoryRepository.listByUserIdAndType(user.id, type)
      : await userProfileMemoryRepository.listByUserId(user.id);

    return NextResponse.json(memories);
  } catch (error) {
    console.error('GET /api/career/memories error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const title = String(body.title || '').trim();
    const content = String(body.content || '').trim();
    const type = ALLOWED_TYPES.has(String(body.type)) ? String(body.type) : 'profile';

    if (!title) return NextResponse.json({ error: 'Memory title is required' }, { status: 400 });

    const memory = await userProfileMemoryRepository.create({
      userId: user.id,
      type,
      title,
      content,
      source: String(body.source || 'manual'),
      confidence: typeof body.confidence === 'number' ? body.confidence : 80,
      metadata: body.metadata || {},
    });

    return NextResponse.json(memory, { status: 201 });
  } catch (error) {
    console.error('POST /api/career/memories error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
