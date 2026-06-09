import { NextRequest, NextResponse } from 'next/server';
import { resolveUser, getUserIdFromRequest } from '@/lib/auth/helpers';
import { userRepository } from '@/lib/db/repositories/user.repository';
import { hasServerImageAIConfig, selectServerAIConfig } from '@/lib/ai/server-config';
import { sanitizeMcpSettings } from '@/lib/mcp/user-mcp-access';
import { walletRepository } from '@/lib/db/repositories/commercial.repository';
import { WALLET_CURRENCY_AI_CREDIT } from '@/lib/commercial/catalog';

export async function GET(request: NextRequest) {
  try {
    const fingerprint = getUserIdFromRequest(request);
    const user = await resolveUser(fingerprint);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const settings = await userRepository.getSettings(user.id);
    const serverAI = await selectServerAIConfig();
    const aiCreditAccount = await walletRepository
      .findAccount(user.id, WALLET_CURRENCY_AI_CREDIT)
      .catch(() => null);
    const aiCredits = Number(aiCreditAccount?.balance ?? user.aiCredits ?? 0);
    const serverAIConfigured = !!serverAI.apiKey && !!user.email;
    return NextResponse.json({
      ...sanitizeMcpSettings(settings),
      aiCredits,
      serverAIConfigured,
      serverAIAvailable: serverAIConfigured && (user.role === 'admin' || aiCredits > 0),
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
    const allowedKeys = ['autoSave', 'autoSaveInterval', 'browserNotifications'];
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
