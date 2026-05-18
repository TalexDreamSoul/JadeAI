import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { aiChannelRepository, type AIChannelRecord } from '@/lib/db/repositories/ai-channel.repository';

async function requireAdmin(request: NextRequest) {
  const user = await resolveUser(getUserIdFromRequest(request));
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (user.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { user };
}

function sanitize(channel: AIChannelRecord | null) {
  if (!channel) return null;
  return { ...channel, apiKey: channel.apiKey ? '********' : '' };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    const { id } = await params;
    const channel = await aiChannelRepository.findById(id);
    if (!channel) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const updated = await aiChannelRepository.update(id, {
      ...(body.name !== undefined ? { name: String(body.name) } : {}),
      ...(body.provider !== undefined ? { provider: String(body.provider) } : {}),
      ...(body.apiKey !== undefined && body.apiKey !== '********' ? { apiKey: String(body.apiKey) } : {}),
      ...(body.baseUrl !== undefined ? { baseUrl: String(body.baseUrl) } : {}),
      ...(body.model !== undefined ? { model: String(body.model) } : {}),
      ...(body.openAIEndpoint !== undefined ? { openAIEndpoint: body.openAIEndpoint === 'responses' ? 'responses' : 'chat' } : {}),
      ...(body.weight !== undefined ? { weight: Number(body.weight) || 1 } : {}),
      ...(body.enabled !== undefined ? { enabled: Boolean(body.enabled) } : {}),
    });

    return NextResponse.json(sanitize(updated));
  } catch (error) {
    console.error('PATCH /api/admin/ai-channels/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
