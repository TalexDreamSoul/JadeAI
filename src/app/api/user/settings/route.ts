import { NextRequest, NextResponse } from 'next/server';
import { resolveUser, getUserIdFromRequest } from '@/lib/auth/helpers';
import { userRepository } from '@/lib/db/repositories/user.repository';
import { hasServerImageAIConfig, selectServerAIConfig } from '@/lib/ai/server-config';
import { sanitizeMcpSettings } from '@/lib/mcp/user-mcp-access';

export async function GET(request: NextRequest) {
  try {
    const fingerprint = getUserIdFromRequest(request);
    const user = await resolveUser(fingerprint);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const settings = await userRepository.getSettings(user.id);
    const serverAI = await selectServerAIConfig();
    return NextResponse.json({
      ...sanitizeMcpSettings(settings),
      aiCredits: user.aiCredits,
      serverAIConfigured: !!serverAI.apiKey && !!user.email && user.aiCredits > 0,
      serverAIProvider: serverAI.provider,
      serverAIModel: serverAI.model,
      serverOpenAIEndpoint: serverAI.openAIEndpoint,
      serverImageAIConfigured: hasServerImageAIConfig(),
    });
  } catch (error) {
    console.error('GET /api/user/settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const fingerprint = getUserIdFromRequest(request);
    const user = await resolveUser(fingerprint);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Only allow known settings keys (exclude sensitive data like API keys)
    const allowedKeys = ['aiMode', 'aiProvider', 'aiBaseURL', 'aiModel', 'openAIEndpoint', 'autoSave', 'autoSaveInterval', 'browserNotifications'];
    const filtered: Record<string, unknown> = {};
    for (const key of allowedKeys) {
      if (key in body) {
        filtered[key] = body[key];
      }
    }

    const settings = await userRepository.updateSettings(user.id, filtered);
    return NextResponse.json(settings);
  } catch (error) {
    console.error('PUT /api/user/settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
