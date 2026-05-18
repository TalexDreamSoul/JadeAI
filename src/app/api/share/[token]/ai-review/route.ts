import { NextRequest, NextResponse } from 'next/server';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { extractJson } from '@/lib/ai/extract-json';
import { extractAIConfig, getModel, getProviderOptions, AIConfigError } from '@/lib/ai/provider';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import { shareRepository } from '@/lib/db/repositories/share.repository';
import { sanitizeResumeForShare } from '@/lib/share/review';
import { hashPassword } from '@/lib/utils/share';

const aiReviewSchema = z.object({
  score: z.number().min(0).max(100),
  summary: z.string(),
  strengths: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  actions: z.array(z.object({
    section: z.string(),
    priority: z.enum(['high', 'medium', 'low']).default('medium'),
    suggestion: z.string(),
  })).default([]),
});

const SYSTEM = `You are a senior resume reviewer. Review the resume for recruiter readability, ATS quality, impact, clarity, and role alignment.
Return JSON only with fields: score, summary, strengths, risks, actions. Match the resume language.`;

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

    const rawResume = await resumeRepository.findById(result.share!.resumeId);
    if (!rawResume) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const resume = sanitizeResumeForShare(rawResume, !!result.share!.hideSensitiveInfo);

    const aiConfig = await extractAIConfig(request);
    const aiResult = await generateText({
      model: getModel(aiConfig),
      system: SYSTEM,
      prompt: JSON.stringify({ resume: resume.sections, focus: body.focus || 'overall' }),
      maxOutputTokens: 4096,
      providerOptions: getProviderOptions(aiConfig),
      output: Output.json(),
    });

    return NextResponse.json(extractJson(aiResult.text, aiReviewSchema));
  } catch (error) {
    if (error instanceof AIConfigError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error('POST /api/share/[token]/ai-review error:', error);
    return NextResponse.json({ error: 'Failed to review resume' }, { status: 500 });
  }
}
