import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { generateJsonWithRetry, getAIJsonErrorMessage } from '@/lib/ai/generate-json';
import { aiReviewSchema } from '@/lib/ai/ai-review-schema';
import { extractAIConfig, getModel, getProviderOptions, AIConfigError } from '@/lib/ai/provider';
import { aiReviewRepository } from '@/lib/db/repositories/ai-review.repository';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import { shareRepository } from '@/lib/db/repositories/share.repository';
import { getReviewerDisplay, sanitizeResumeForShare } from '@/lib/share/review';
import { hashPassword } from '@/lib/utils/share';
import { safeParseJson } from '@/lib/safe-json';
import { AIUsageInsufficientCreditsError, withMeteredAIUsage } from '@/lib/commercial/ai-route-metering';

const SYSTEM = `You are a senior resume reviewer. Review the resume for recruiter readability, ATS quality, impact, clarity, and role alignment.
If selected text is provided, focus on that selected passage and produce precise, actionable comments for it.
Return JSON only with fields: score, summary, strengths, risks, actions. Match the resume language.`;

type HighlightRect = { top: number; left: number; width: number; height: number };
type ReviewAnchor = { top?: number; left?: number; width?: number; height?: number; rects?: HighlightRect[] };

function buildActionComment(action: z.infer<typeof aiReviewSchema>['actions'][number]) {
  return `AI 评审分析，仅供参考\n\n${action.priority ? `优先级：${action.priority}\n` : ''}${action.suggestion}`;
}

function compact(value: unknown) {
  return String(value || '').trim();
}

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const result = await resolveShare(token, request.nextUrl.searchParams.get('password'));
    if (result.error) return result.error;

    const user = await resolveUser(getUserIdFromRequest(request));
    if (result.share!.viewRequiresLogin && !user) {
      return NextResponse.json({ error: 'Login required', loginRequired: true }, { status: 401 });
    }

    const rows: Awaited<ReturnType<typeof aiReviewRepository.findByResumeId>> = await aiReviewRepository.findByResumeId(result.share!.resumeId, 20);
    return NextResponse.json(rows.map((row: Awaited<ReturnType<typeof aiReviewRepository.findByResumeId>>[number]) => {
      const parsed = safeParseJson(row.result, null);
      const status = row.status || 'success';
      return {
        id: row.id,
        score: row.score,
        result: parsed && typeof parsed === 'object' && Object.keys(parsed as Record<string, unknown>).length > 0 ? parsed : null,
        status,
        error: row.error || undefined,
        createdAt: row.createdAt,
      };
    }));
  } catch (error) {
    console.error('GET /api/share/[token]/ai-review error:', error);
    return NextResponse.json({ error: 'Failed to fetch review history' }, { status: 500 });
  }
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
    if (!user) {
      return NextResponse.json({ error: 'Login required', loginRequired: true }, { status: 401 });
    }

    const rawResume = await resumeRepository.findById(result.share!.resumeId);
    if (!rawResume) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const resume = sanitizeResumeForShare(rawResume, !!result.share!.hideSensitiveInfo);

    const selectedText = compact(body.selectedText);
    const selectedAnchor = body.anchor && typeof body.anchor === 'object' ? body.anchor as ReviewAnchor : null;
    const attempt = await aiReviewRepository.createAttempt({
      resumeId: result.share!.resumeId,
      userId: user.id,
    }).catch((error) => {
      console.error('Failed to create shared AI review attempt:', error);
      return null;
    });
    const historyId = attempt?.id;

    try {
      const aiConfig = await extractAIConfig(request);
      const metered = await withMeteredAIUsage({
        userId: user.id,
        aiConfig,
        feature: 'share.ai_review',
        metadata: {
          token,
          resumeId: result.share!.resumeId,
          historyId,
          focus: body.focus || (selectedText ? 'selection' : 'overall'),
        },
        run: async () => {
          const { data: review, usage } = await generateJsonWithRetry({
            label: 'shared-ai-review',
            model: getModel(aiConfig),
            schema: aiReviewSchema,
            system: SYSTEM,
            prompt: JSON.stringify({
              resume: resume.sections,
              focus: body.focus || (selectedText ? 'selection' : 'overall'),
              selectedText: selectedText || undefined,
              sectionId: body.sectionId ? String(body.sectionId) : undefined,
            }),
            maxOutputTokens: 4096,
            providerOptions: getProviderOptions(aiConfig),
          });
          const saved = historyId
            ? await aiReviewRepository.markSuccess(historyId, { result: review, score: review.score })
            : await aiReviewRepository.create({
                resumeId: result.share!.resumeId,
                userId: user.id,
                result: review,
                score: review.score,
              });

          return {
            value: { review, saved },
            usage,
            metadata: {
              token,
              resumeId: result.share!.resumeId,
              historyId: saved?.id || historyId,
              focus: body.focus || (selectedText ? 'selection' : 'overall'),
            },
          };
        },
      });
      const { review, saved } = metered;

      let comments: unknown[] = [];
      if (body.createComments !== false) {
        const reviewerDisplay = getReviewerDisplay(user);
        const actions = review.actions?.length
          ? review.actions.slice(0, selectedText ? 3 : 5)
          : [{ section: selectedText ? 'selection' : 'overall', priority: 'medium' as const, suggestion: review.summary }];
        comments = await Promise.all(actions.map((action) => shareRepository.createComment({
          shareId: result.share!.id,
          resumeId: result.share!.resumeId,
          parentCommentId: null,
          authorUserId: user.id,
          authorName: reviewerDisplay.name,
          authorEmail: reviewerDisplay.email,
          sectionId: body.sectionId ? String(body.sectionId) : null,
          selectedText: selectedText || (action.section ? `AI 评审分析：${action.section}` : 'AI 评审分析'),
          anchor: selectedAnchor,
          content: buildActionComment(action),
        })));
      }

      return NextResponse.json({ ...review, historyId: saved?.id || historyId, comments });
    } catch (error) {
      const message = getAIJsonErrorMessage(error, 'Failed to review resume');
      if (historyId) await aiReviewRepository.markFailed(historyId, message).catch(() => null);
      if (error instanceof AIConfigError) {
        return NextResponse.json({ error: message, historyId }, { status: 401 });
      }
      if (error instanceof AIUsageInsufficientCreditsError) {
        return NextResponse.json({ error: error.message, historyId }, { status: 402 });
      }
      console.error('POST /api/share/[token]/ai-review error:', error);
      return NextResponse.json({ error: message, historyId }, { status: 500 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to review resume';
    console.error('POST /api/share/[token]/ai-review setup error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
