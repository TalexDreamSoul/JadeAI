import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { aiChannelRepository } from '@/lib/db/repositories/ai-channel.repository';
import { testAIChannelConfig } from '@/lib/ai/compatibility';

async function requireAdmin(request: NextRequest) {
  const user = await resolveUser(getUserIdFromRequest(request));
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (user.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { user };
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    const body = await request.json().catch(() => ({}));
    let apiKey = String(body.apiKey || '').trim();
    let provider = String(body.provider || 'openai').trim();
    let baseUrl = String(body.baseUrl || '').trim();
    let model = String(body.model || '').trim();
    let openAIEndpoint = String(body.openAIEndpoint || 'chat').trim();

    if (body.id) {
      const channel = await aiChannelRepository.findById(String(body.id));
      if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
      provider = String(body.provider || channel.provider || provider).trim();
      baseUrl = String(body.baseUrl || channel.baseUrl || baseUrl).trim();
      model = String(body.model || channel.model || model).trim();
      openAIEndpoint = String(body.openAIEndpoint || channel.openAIEndpoint || openAIEndpoint).trim();
      if (!apiKey || apiKey === '********') apiKey = channel.apiKey;
    }

    const result = await testAIChannelConfig({ provider, apiKey, baseUrl, model, openAIEndpoint });
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (error) {
    console.error('POST /api/admin/ai-channels/test error:', error);
    return NextResponse.json({
      ok: false,
      error: 'AI channel test failed',
      message: error instanceof Error ? error.message : String(error || 'Unknown error'),
    }, { status: 500 });
  }
}
