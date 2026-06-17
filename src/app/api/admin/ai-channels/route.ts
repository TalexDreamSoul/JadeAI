import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { aiChannelRepository, type AIChannelRecord } from '@/lib/db/repositories/ai-channel.repository';
import { normalizeOpenAICompatibleBaseUrl } from '@/lib/ai/compatibility';

async function requireAdmin(request: NextRequest) {
  const user = await resolveUser(getUserIdFromRequest(request));
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (user.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { user };
}

function sanitize(channel: AIChannelRecord | null) {
  if (!channel) return null;
  return {
    ...channel,
    apiKey: channel.apiKey ? '********' : '',
  };
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin.error) return admin.error;
  const channels = await aiChannelRepository.list();
  return NextResponse.json(channels.map(sanitize));
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    const body = await request.json().catch(() => ({}));
    const name = String(body.name || '').trim();
    const provider = String(body.provider || 'openai').trim();
    const apiKey = String(body.apiKey || '').trim();
    const rawBaseUrl = String(body.baseUrl || '').trim();
    const baseUrl = provider === 'openai' ? normalizeOpenAICompatibleBaseUrl(rawBaseUrl) : rawBaseUrl;
    const model = String(body.model || '').trim();
    if (!name || !apiKey || !baseUrl || !model) {
      return NextResponse.json({ error: 'name, apiKey, baseUrl and model are required' }, { status: 400 });
    }

    const channel = await aiChannelRepository.create({
      name,
      provider,
      apiKey,
      baseUrl,
      model,
      openAIEndpoint: body.openAIEndpoint === 'responses' ? 'responses' : 'chat',
      weight: Number(body.weight) || 1,
      enabled: body.enabled !== false,
    });

    return NextResponse.json(sanitize(channel), { status: 201 });
  } catch (error) {
    console.error('POST /api/admin/ai-channels error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
