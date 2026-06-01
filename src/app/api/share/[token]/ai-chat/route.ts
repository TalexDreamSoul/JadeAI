import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { extractAIConfig, getModel, getProviderOptions, AIConfigError } from '@/lib/ai/provider';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import { shareRepository } from '@/lib/db/repositories/share.repository';
import { sanitizeResumeForShare } from '@/lib/share/review';
import { hashPassword } from '@/lib/utils/share';
import { AIUsageInsufficientCreditsError, withMeteredAIUsage } from '@/lib/commercial/ai-route-metering';

async function resolveShare(token: string, password: string | null) {
  const share = await shareRepository.findByToken(token);
  if (!share || !share.isActive) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  if (!share.reviewEnabled) return { error: NextResponse.json({ error: 'Review is disabled' }, { status: 403 }) };
  if (share.password) {
    if (!password) return { error: NextResponse.json({ error: 'Password required', passwordRequired: true }, { status: 401 }) };
    if (await hashPassword(password) !== share.password) {
      return { error: NextResponse.json({ error: 'Invalid password', passwordRequired: true }, { status: 401 }) };
    }
  }
  return { share };
}

const SYSTEM = `You are a concise AI resume-review assistant for a shared resume review page.
Answer questions about the resume, identify risks, suggest improvements, and compare against reviewer concerns.
Do not claim you can edit the resume directly. Match the user's language. Keep answers practical and brief.`;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json().catch(() => ({}));
    const result = await resolveShare(token, body.password ? String(body.password) : null);
    if (result.error) return result.error;

    const user = await resolveUser(getUserIdFromRequest(request));
    if (result.share!.viewRequiresLogin && !user) {
      return NextResponse.json({ error: 'Login required', loginRequired: true }, { status: 401 });
    }

    const message = String(body.message || '').trim();
    if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 });

    const rawResume = await resumeRepository.findById(result.share!.resumeId);
    if (!rawResume) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const resume = sanitizeResumeForShare(rawResume, !!result.share!.hideSensitiveInfo);
    const aiConfig = await extractAIConfig(request);
    const history = Array.isArray(body.history) ? body.history.slice(-6) : [];

    const aiResult = await withMeteredAIUsage({
      userId: user?.id,
      aiConfig,
      feature: 'share.ai_chat',
      metadata: { token, resumeId: result.share!.resumeId, historyCount: history.length },
      run: async () => {
        const output = await generateText({
          model: getModel(aiConfig),
          system: SYSTEM,
          prompt: JSON.stringify({
            resume: resume.sections,
            history,
            message,
          }),
          maxOutputTokens: 1200,
          providerOptions: getProviderOptions(aiConfig),
        });
        return {
          value: output,
          usage: output.usage,
          metadata: { token, resumeId: result.share!.resumeId, historyCount: history.length },
        };
      },
    });
    return NextResponse.json({ message: aiResult.text });
  } catch (error) {
    if (error instanceof AIConfigError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof AIUsageInsufficientCreditsError) {
      return NextResponse.json({ error: error.message }, { status: 402 });
    }
    console.error('POST /api/share/[token]/ai-chat error:', error);
    return NextResponse.json({ error: 'Failed to chat with AI' }, { status: 500 });
  }
}
