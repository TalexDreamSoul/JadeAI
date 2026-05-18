import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { userRepository } from '@/lib/db/repositories/user.repository';

async function requireAdmin(request: NextRequest) {
  const user = await resolveUser(getUserIdFromRequest(request));
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (user.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { user };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const patch: Partial<{ role: 'user' | 'admin'; aiCredits: number }> = {};

    if (body.role === 'user' || body.role === 'admin') {
      patch.role = body.role;
    }
    if (body.aiCredits !== undefined) {
      patch.aiCredits = Math.max(0, Math.floor(Number(body.aiCredits) || 0));
    }

    const updated = await userRepository.update(id, patch);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      avatarUrl: updated.avatarUrl,
      authType: updated.authType,
      role: updated.role,
      aiCredits: updated.aiCredits,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    console.error('PATCH /api/admin/users/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
