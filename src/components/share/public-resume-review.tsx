'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import {
  Bot,
  CircleDot,
  FileSearch,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import { ReviewedResumeView, anchorToRects } from '@/components/share/reviewed-resume-view';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/use-auth';
import { getAIHeaders, hasUsableAIConfig } from '@/stores/settings-store';
import type { Resume } from '@/types/resume';

interface ShareMeta {
  reviewEnabled: boolean;
  downloadEnabled: boolean;
  viewRequiresLogin: boolean;
  anonymousShare: boolean;
  hideSensitiveInfo: boolean;
  shareLabel?: string;
  ownerName?: string | null;
}

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface ReviewAnchor {
  x?: number;
  y?: number;
  top?: number;
  height?: number;
  left?: number;
  width?: number;
  rects?: HighlightRect[];
}

interface ReviewComment {
  id: string;
  parentCommentId?: string | null;
  authorName: string;
  authorEmail?: string | null;
  authorUserId?: string | null;
  sectionId?: string | null;
  selectedText?: string | null;
  anchor?: ReviewAnchor | null;
  content: string;
  status?: string;
  createdAt: string;
}

interface PresenceUser {
  id: string;
  userId: string;
  reviewerName: string;
  reviewerEmail?: string | null;
  reviewerAvatarUrl?: string | null;
  cursorX: number;
  cursorY: number;
  color: string;
  isSelf?: boolean;
}

interface AIReviewResult {
  score: number;
  summary: string;
  strengths: string[];
  risks: string[];
  actions: { section: string; priority: string; suggestion: string }[];
}

interface JdAnalysisResult {
  overallScore: number;
  atsScore: number;
  keywordMatches: string[];
  missingKeywords: string[];
  suggestions: { section: string; current: string; suggested: string }[];
  summary: string;
}

interface SelectionState {
  text: string;
  sectionId: string | null;
  anchor: ReviewAnchor;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function getFingerprintHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const fingerprint = localStorage.getItem('touchresume_fingerprint');
  return fingerprint ? { 'x-fingerprint': fingerprint } : {};
}

function initials(name?: string | null) {
  return (name || 'R').trim().slice(0, 1).toUpperCase();
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function safeCopy(value: string, fallback: string) {
  return value.startsWith('publicView.') ? fallback : value;
}

function VisitorWatermarkLayer({ text }: { text: string }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none" aria-hidden="true">
      <div className="absolute -inset-32 grid grid-cols-3 gap-x-28 gap-y-20 -rotate-[24deg] text-[11px] font-medium tracking-[0.24em] text-zinc-900/[0.035] dark:text-white/[0.055] md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 70 }).map((_, index) => (
          <div key={index} className="whitespace-nowrap">
            {text}
          </div>
        ))}
      </div>
    </div>
  );
}

function ResumeSensitiveWatermark({ text }: { text: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden select-none" aria-hidden="true">
      <div className="absolute -inset-20 grid grid-cols-2 gap-x-20 gap-y-14 -rotate-[24deg] text-[12px] font-semibold tracking-[0.22em] text-red-600/[0.075] dark:text-red-300/[0.12] sm:grid-cols-3">
        {Array.from({ length: 36 }).map((_, index) => (
          <div key={index} className="whitespace-nowrap">
            {text}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PublicResumeReview({
  token,
  password,
  resume,
  shareMeta,
}: {
  token: string;
  password?: string;
  resume: Resume;
  shareMeta: ShareMeta;
}) {
  const t = useTranslations('publicView');
  const { user, isAuthenticated } = useAuth();
  const previewRef = useRef<HTMLDivElement>(null);
  const selectionMarkerRef = useRef<HTMLSpanElement | null>(null);
  const lastCursorRef = useRef({ x: 0, y: 0 });
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [draft, setDraft] = useState('');
  const [activeLeftTab, setActiveLeftTab] = useState<'info' | 'review' | 'jd'>('info');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [hoveredCommentId, setHoveredCommentId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReview, setAiReview] = useState<AIReviewResult | null>(null);
  const [jdText, setJdText] = useState('');
  const [jdLoading, setJdLoading] = useState(false);
  const [jdResult, setJdResult] = useState<JdAnalysisResult | null>(null);
  const [aiChatInput, setAiChatInput] = useState('');
  const [aiChatLoading, setAiChatLoading] = useState(false);
  const [aiChatMessages, setAiChatMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState('');

  const passwordQuery = password ? `?password=${encodeURIComponent(password)}` : '';
  const ownerName = shareMeta.ownerName || safeCopy(t('resumeOwner'), 'Resume owner');
  const visitorName = user?.name || user?.email || safeCopy(t('visitorFallback'), 'Visitor');
  const copyright = safeCopy(t('copyright', { owner: ownerName }), `© TouchResume & ${ownerName}`);
  const visitorWatermark = `${safeCopy(t('visitor'), 'Visitor')}: ${visitorName} · ${copyright}`;
  const sensitiveWatermark = `${safeCopy(t('sensitiveWatermark'), 'Sensitive content - do not share')} · ${safeCopy(t('antiCrawlerWatermark'), 'No AI crawler / training collection')}`;
  const aiAvailable = isAuthenticated && hasUsableAIConfig();

  const headers = useCallback((json = false): Record<string, string> => ({
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...getFingerprintHeader(),
  }), []);

  const aiHeaders = useCallback((): Record<string, string> => ({
    'Content-Type': 'application/json',
    ...getAIHeaders(),
    ...getFingerprintHeader(),
  }), []);

  const fetchComments = useCallback(async () => {
    if (!shareMeta.reviewEnabled) return;
    setCommentsLoading(true);
    try {
      const res = await fetch(`/api/share/${token}/comments${passwordQuery}`, { headers: headers() });
      if (res.ok) setComments(await res.json());
    } finally {
      setCommentsLoading(false);
    }
  }, [headers, passwordQuery, shareMeta.reviewEnabled, token]);

  const pulsePresence = useCallback(async () => {
    if (!shareMeta.reviewEnabled) return;
    try {
      const res = await fetch(`/api/share/${token}/presence`, {
        method: 'POST',
        headers: headers(true),
        body: JSON.stringify({
          password: password || undefined,
          cursorX: lastCursorRef.current.x,
          cursorY: lastCursorRef.current.y,
        }),
      });
      if (res.ok) setPresence(await res.json());
    } catch {
      // presence is best-effort
    }
  }, [headers, password, shareMeta.reviewEnabled, token]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  useEffect(() => {
    if (!shareMeta.reviewEnabled) return;
    const getPresence = async () => {
      try {
        const res = await fetch(`/api/share/${token}/presence${passwordQuery}`, { headers: headers() });
        if (res.ok) setPresence(await res.json());
      } catch { /* best effort */ }
    };
    getPresence();
    const interval = window.setInterval(getPresence, 5_000);
    return () => window.clearInterval(interval);
  }, [headers, passwordQuery, shareMeta.reviewEnabled, token]);

  useEffect(() => {
    if (!shareMeta.reviewEnabled || !isAuthenticated) return;
    pulsePresence();
    const interval = window.setInterval(pulsePresence, 4_000);
    return () => window.clearInterval(interval);
  }, [isAuthenticated, pulsePresence, shareMeta.reviewEnabled]);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      lastCursorRef.current = { x: event.clientX, y: event.clientY };
    };
    window.addEventListener('mousemove', onMouseMove);
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, []);

  const clearSelectionMarker = useCallback(() => {
    selectionMarkerRef.current = null;
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!shareMeta.reviewEnabled) return;
    window.setTimeout(() => {
      const sel = window.getSelection();
      const text = sel?.toString().trim();
      if (!sel || !text || sel.rangeCount === 0 || !previewRef.current) return;
      const range = sel.getRangeAt(0);
      const common = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? range.commonAncestorContainer as Element
        : range.commonAncestorContainer.parentElement;
      if (!common || !previewRef.current.contains(common)) return;

      clearSelectionMarker();
      const rect = range.getBoundingClientRect();
      const previewRect = previewRef.current.getBoundingClientRect();
      const section = common.closest('[data-section-id]') as HTMLElement | null;
      const rects = Array.from(range.getClientRects())
        .filter((item) => item.width > 0 && item.height > 0)
        .map((item) => ({
          top: item.top - previewRect.top,
          left: item.left - previewRect.left,
          width: item.width,
          height: item.height,
        }));

      setSelection({
        text,
        sectionId: section?.dataset.sectionId || null,
        anchor: {
          x: rect.left - previewRect.left + rect.width / 2,
          y: rect.top - previewRect.top,
          top: rect.top - previewRect.top,
          left: rect.left - previewRect.left,
          width: rect.width,
          height: rect.height,
          rects,
        },
      });
    }, 0);
  }, [clearSelectionMarker, shareMeta.reviewEnabled]);

  const createComment = async (content: string, options?: { parentCommentId?: string }) => {
    const trimmed = content.trim();
    if (!trimmed || submitting) return null;
    if (shareMeta.reviewEnabled && !isAuthenticated) {
      signIn(undefined, { callbackUrl: window.location.href });
      return null;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/share/${token}/comments`, {
        method: 'POST',
        headers: headers(true),
        body: JSON.stringify({
          password: password || undefined,
          content: trimmed,
          parentCommentId: options?.parentCommentId,
          sectionId: options?.parentCommentId ? undefined : selection?.sectionId || undefined,
          selectedText: options?.parentCommentId ? undefined : selection?.text || undefined,
          anchor: options?.parentCommentId ? undefined : selection?.anchor || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.loginRequired) signIn(undefined, { callbackUrl: window.location.href });
        throw new Error(data.error || t('submitReview'));
      }
      setComments((prev) => [data, ...prev]);
      return data as ReviewComment;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  const submitComment = async () => {
    const created = await createComment(draft);
    if (created) {
      setDraft('');
      setSelection(null);
      clearSelectionMarker();
    }
  };

  const submitReply = async (commentId: string) => {
    const created = await createComment(replyDrafts[commentId] || '', { parentCommentId: commentId });
    if (created) {
      setReplyDrafts((prev) => ({ ...prev, [commentId]: '' }));
      setActiveReplyId(null);
    }
  };

  const resolveComment = async (commentId: string) => {
    if (!isAuthenticated) {
      signIn(undefined, { callbackUrl: window.location.href });
      return;
    }
    setError('');
    try {
      const res = await fetch(`/api/share/${token}/comments/${commentId}`, {
        method: 'PATCH',
        headers: headers(true),
        body: JSON.stringify({ password: password || undefined, status: 'resolved' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.loginRequired) signIn(undefined, { callbackUrl: window.location.href });
        throw new Error(data.error || t('resolveComment'));
      }
      setComments((prev) => prev.map((comment) => comment.id === commentId ? { ...comment, status: 'resolved' } : comment));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const requireAIAvailable = () => {
    if (!isAuthenticated) {
      setError(t('loginRequired'));
      signIn(undefined, { callbackUrl: window.location.href });
      return false;
    }
    if (!hasUsableAIConfig()) {
      setError(t('aiConfigRequired'));
      return false;
    }
    return true;
  };

  const runAiReview = async () => {
    if (!requireAIAvailable()) return;
    setAiLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/share/${token}/ai-review`, {
        method: 'POST',
        headers: aiHeaders(),
        body: JSON.stringify({ password: password || undefined, focus: 'overall' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('aiReview'));
      setAiReview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAiLoading(false);
    }
  };

  const runJdAnalysis = async () => {
    if (!jdText.trim() || !requireAIAvailable()) return;
    setJdLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/share/${token}/jd-analysis`, {
        method: 'POST',
        headers: aiHeaders(),
        body: JSON.stringify({ password: password || undefined, jobDescription: jdText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('jdMatch'));
      setJdResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setJdLoading(false);
    }
  };

  const sendAiChat = async () => {
    const message = aiChatInput.trim();
    if (!message || aiChatLoading || !requireAIAvailable()) return;

    const nextMessages: ChatMessage[] = [...aiChatMessages, { role: 'user', content: message }];
    setAiChatMessages(nextMessages);
    setAiChatInput('');
    setAiChatLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/share/${token}/ai-chat`, {
        method: 'POST',
        headers: aiHeaders(),
        body: JSON.stringify({
          password: password || undefined,
          message,
          history: aiChatMessages.slice(-6),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('aiChatFailed'));
      setAiChatMessages((prev) => [...prev, { role: 'assistant', content: String(data.message || '') }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setAiChatMessages((prev) => [...prev, { role: 'assistant', content: t('aiChatFailed') }]);
    } finally {
      setAiChatLoading(false);
    }
  };

  const reviewers = useMemo(() => {
    const map = new Map<string, { name: string; email?: string | null; avatar?: string | null; color?: string }>();
    for (const p of presence) map.set(p.userId, { name: p.reviewerName, email: p.reviewerEmail, avatar: p.reviewerAvatarUrl, color: p.color });
    for (const c of comments) {
      const key = c.authorUserId || c.authorEmail || c.authorName;
      if (!map.has(key)) map.set(key, { name: c.authorName, email: c.authorEmail });
    }
    return Array.from(map.values());
  }, [comments, presence]);

  const rootComments = comments.filter((comment) => !comment.parentCommentId);
  const repliesByParent = useMemo(() => {
    const map = new Map<string, ReviewComment[]>();
    for (const comment of comments) {
      if (!comment.parentCommentId) continue;
      const existing = map.get(comment.parentCommentId) || [];
      existing.push(comment);
      map.set(comment.parentCommentId, existing);
    }
    return map;
  }, [comments]);
  const anchoredComments = rootComments.filter((comment) => comment.anchor?.top !== undefined && comment.status !== 'resolved');
  const unanchoredComments = rootComments.filter((comment) => comment.anchor?.top === undefined || comment.status === 'resolved');
  const activeHighlightRects = anchorToRects(selection?.anchor);

  return (
    <>
      <VisitorWatermarkLayer text={visitorWatermark} />

      <div className="relative z-10 grid h-full min-h-0 w-full grid-cols-1 gap-0 overflow-hidden px-4 py-0 sm:px-6 xl:grid-cols-[320px_minmax(0,1fr)_320px]">
        {/* Left panel */}
        <aside className="flex min-h-0 flex-col overflow-y-auto pr-4 xl:border-r xl:border-zinc-200 dark:xl:border-zinc-800">
          <div className="mb-4 grid shrink-0 grid-cols-3 border-b border-zinc-200 text-xs dark:border-zinc-800">
            {([
              ['info', t('basicInfo')],
              ['review', t('aiTools')],
              ['jd', t('jdMatch')],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveLeftTab(key)}
                className={`border-b-2 px-2 py-2 text-center font-medium transition-colors ${activeLeftTab === key ? 'border-brand text-brand' : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {activeLeftTab === 'info' && (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="border-b border-zinc-200 pb-4 dark:border-zinc-800">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  <Users className="h-4 w-4 text-brand" />
                  {t('reviewers')}
                </div>
                <div className="mb-3 text-xs text-zinc-500">
                  <div className="font-medium text-zinc-700 dark:text-zinc-200">{t('sharedBy')}</div>
                  <div>{shareMeta.anonymousShare ? t('anonymousSharer') : (shareMeta.shareLabel || ownerName)}</div>
                </div>
                <div className="space-y-2">
                  {reviewers.length === 0 && <p className="text-xs text-zinc-400">{t('noComments')}</p>}
                  {reviewers.map((reviewer, index) => (
                    <div key={`${reviewer.name}-${index}`} className="flex items-center gap-2 text-sm">
                      <Avatar size="sm">
                        {reviewer.avatar && <AvatarImage src={reviewer.avatar} alt="" />}
                        <AvatarFallback style={{ backgroundColor: reviewer.color || undefined, color: reviewer.color ? 'white' : undefined }}>
                          {initials(reviewer.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-zinc-700 dark:text-zinc-200">{reviewer.name}</div>
                        {reviewer.email && <div className="truncate text-xs text-zinc-400">{reviewer.email}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-auto pt-4 text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500">
                <div>{copyright}</div>
                <div className="mt-1">{t('sensitiveNotice')}</div>
              </div>
            </div>
          )}

          {activeLeftTab === 'review' && shareMeta.reviewEnabled && (
            <div className="space-y-4">
              {!aiAvailable && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                  {isAuthenticated ? t('aiConfigRequired') : t('loginRequired')}
                </div>
              )}
              <div className="border-b border-zinc-200 pb-4 dark:border-zinc-800">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  <Bot className="h-4 w-4 text-brand" />
                  {t('aiChat')}
                </div>
              <div className="mb-3 max-h-64 space-y-2 overflow-y-auto rounded-xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                {aiChatMessages.length === 0 && (
                  <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{t('aiChatIntro')}</p>
                )}
                {aiChatMessages.map((msg, index) => (
                  <div key={index} className={`rounded-lg px-3 py-2 text-xs leading-relaxed ${msg.role === 'user' ? 'ml-6 bg-brand text-white' : 'mr-6 bg-white text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200'}`}>
                    {msg.content}
                  </div>
                ))}
                {aiChatLoading && (
                  <div className="mr-6 flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs text-zinc-400 dark:bg-zinc-900">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {t('loadingAi')}
                  </div>
                )}
              </div>
              <Textarea
                value={aiChatInput}
                onChange={(e) => setAiChatInput(e.target.value)}
                placeholder={t('aiChatPlaceholder')}
                className="min-h-20 text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendAiChat();
                }}
              />
              <Button onClick={sendAiChat} disabled={aiChatLoading || !aiChatInput.trim() || !aiAvailable} className="mt-2 w-full cursor-pointer bg-brand hover:bg-brand-hover">
                {aiChatLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {t('aiChatSend')}
              </Button>
              </div>

              <div className="border-b border-zinc-200 pb-4 dark:border-zinc-800">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  <Bot className="h-4 w-4 text-brand" />
                  {t('aiTools')}
                </div>
              <div className="space-y-3">
                <Button onClick={runAiReview} disabled={aiLoading || !aiAvailable} className="w-full cursor-pointer bg-brand hover:bg-brand-hover">
                  {aiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  {t('runAiReview')}
                </Button>
                {aiReview && (
                  <div className="rounded-xl bg-zinc-50 p-3 text-sm dark:bg-zinc-800/70">
                    <div className="mb-1 text-2xl font-bold text-brand">{aiReview.score}</div>
                    <p className="text-zinc-600 dark:text-zinc-300">{aiReview.summary}</p>
                    <div className="mt-3 space-y-2">
                      {aiReview.strengths.length > 0 && <MiniList title={t('strengths')} items={aiReview.strengths} />}
                      {aiReview.risks.length > 0 && <MiniList title={t('risks')} items={aiReview.risks} />}
                      {aiReview.actions.length > 0 && <MiniList title={t('actions')} items={aiReview.actions.map((a) => `${a.section}: ${a.suggestion}`)} />}
                    </div>
                  </div>
                )}
              </div>
              </div>
            </div>
          )}

          {activeLeftTab === 'review' && !shareMeta.reviewEnabled && (
            <div className="border-b border-zinc-200 pb-4 text-sm text-zinc-500 dark:border-zinc-800">
              {t('reviewDisabled')}
            </div>
          )}

          {activeLeftTab === 'jd' && shareMeta.reviewEnabled && (
            <div className="border-b border-zinc-200 pb-4 dark:border-zinc-800">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                <Target className="h-4 w-4 text-brand" />
                {t('jdMatch')}
              </div>
              <Textarea value={jdText} onChange={(e) => setJdText(e.target.value)} placeholder={t('jdPlaceholder')} className="min-h-28 text-sm" />
              {!aiAvailable && (
                <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                  {isAuthenticated ? t('aiConfigRequired') : t('loginRequired')}
                </div>
              )}
              <Button onClick={runJdAnalysis} disabled={jdLoading || !jdText.trim() || !aiAvailable} variant="outline" className="mt-2 w-full cursor-pointer">
                {jdLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSearch className="mr-2 h-4 w-4" />}
                {t('analyzeJd')}
              </Button>
              {jdResult && (
                <div className="mt-3 space-y-3 rounded-xl bg-zinc-50 p-3 text-sm dark:bg-zinc-800/70">
                  <div className="flex gap-2">
                    <Badge className="bg-brand text-white">{t('score')} {jdResult.overallScore}</Badge>
                    <Badge variant="secondary">ATS {jdResult.atsScore}</Badge>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-300">{jdResult.summary}</p>
                  {jdResult.keywordMatches.length > 0 && <KeywordList title={t('keywordMatches')} items={jdResult.keywordMatches} tone="green" />}
                  {jdResult.missingKeywords.length > 0 && <KeywordList title={t('missingKeywords')} items={jdResult.missingKeywords} tone="orange" />}
                </div>
              )}
            </div>
          )}
        </aside>

        {/* Resume */}
        <main className="min-h-0 w-full overflow-y-auto px-4">
          <ReviewedResumeView
            resume={resume}
            comments={rootComments}
            activeCommentId={activeCommentId}
            onActiveCommentChange={setActiveCommentId}
            previewRef={previewRef}
            onResumeMouseUp={handleMouseUp}
            watermark={<ResumeSensitiveWatermark text={sensitiveWatermark} />}
          >
            {activeHighlightRects.map((rect, index) => (
              <div
                key={`active-highlight-${index}`}
                className="pointer-events-none absolute z-20 border-b-2 border-yellow-400/70 dark:border-yellow-300/70"
                style={{
                  top: `${Math.max(0, rect.top)}px`,
                  left: `${Math.max(0, rect.left)}px`,
                  width: `${Math.max(1, rect.width)}px`,
                  height: `${Math.max(1, rect.height)}px`,
                }}
              />
            ))}
            {presence.filter((p) => !p.isSelf).map((p) => (
              <div
                key={p.userId}
                className="pointer-events-none fixed z-50 transition-transform duration-150"
                style={{ transform: `translate(${clamp(p.cursorX, 0, typeof window !== 'undefined' ? window.innerWidth - 120 : p.cursorX)}px, ${clamp(p.cursorY, 0, typeof window !== 'undefined' ? window.innerHeight - 40 : p.cursorY)}px)` }}
              >
                <div className="flex items-start gap-1">
                  <CircleDot className="h-4 w-4" style={{ color: p.color }} />
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white" style={{ backgroundColor: p.color }}>
                    {p.reviewerName}
                  </span>
                </div>
              </div>
            ))}
          </ReviewedResumeView>
        </main>

        {/* Right comments */}
        <aside className="relative min-h-0 overflow-y-auto pl-4">
          <div className="border-l border-zinc-200 bg-white/70 pl-4 dark:border-zinc-800 dark:bg-zinc-950/40">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              <MessageSquare className="h-4 w-4 text-brand" />
              {t('review')}
            </div>

            {shareMeta.reviewEnabled ? (
              <>
                {!isAuthenticated && (
                  <div className="mb-3 rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    <p className="mb-2">{t('loginRequired')}</p>
                    <Button size="sm" onClick={() => signIn(undefined, { callbackUrl: window.location.href })} className="cursor-pointer bg-brand hover:bg-brand-hover">
                      {t('loginToReview')}
                    </Button>
                  </div>
                )}

                <div className="space-y-2 border-b border-zinc-200 pb-3 dark:border-zinc-800">
                  {selection ? (
                    <div className="rounded-lg bg-yellow-50 px-2 py-1.5 text-xs text-yellow-800 dark:bg-yellow-500/10 dark:text-yellow-100">
                      <div className="mb-1 font-medium">{t('selectedText')}</div>
                      <div className="line-clamp-3">{selection.text}</div>
                    </div>
                  ) : (
                    <div className="text-xs text-zinc-400">{t('generalComment')}</div>
                  )}
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={selection ? t('commentPlaceholder') : t('reviewPlaceholder')}
                    className="min-h-24 bg-white text-sm dark:bg-zinc-900"
                  />
                  <Button onClick={submitComment} disabled={submitting || !draft.trim()} className="w-full cursor-pointer bg-brand hover:bg-brand-hover">
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    {selection ? t('commentOnSelection') : t('submitReview')}
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-zinc-500">{t('reviewDisabled')}</p>
            )}

            {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-300">{error}</p>}

            <div className="mt-4 space-y-3">
              {commentsLoading && <Loader2 className="mx-auto h-5 w-5 animate-spin text-zinc-300" />}
              {!commentsLoading && rootComments.length === 0 && <p className="py-4 text-center text-sm text-zinc-400">{t('noComments')}</p>}
              {anchoredComments.map((comment) => (
                <CommentCard
                  key={comment.id}
                  comment={comment}
                  replies={repliesByParent.get(comment.id) || []}
                  isActive={activeCommentId === comment.id || hoveredCommentId === comment.id}
                  isReplying={activeReplyId === comment.id}
                  replyDraft={replyDrafts[comment.id] || ''}
                  submitting={submitting}
                  onClick={() => setActiveCommentId(comment.id)}
                  onMouseEnter={() => setHoveredCommentId(comment.id)}
                  onMouseLeave={() => setHoveredCommentId((current) => current === comment.id ? null : current)}
                  onReply={() => setActiveReplyId(activeReplyId === comment.id ? null : comment.id)}
                  onResolve={() => resolveComment(comment.id)}
                  onReplyDraftChange={(value) => setReplyDrafts((prev) => ({ ...prev, [comment.id]: value }))}
                  onSubmitReply={() => submitReply(comment.id)}
                />
              ))}
              {unanchoredComments.map((comment) => (
                <CommentCard
                  key={comment.id}
                  comment={comment}
                  replies={repliesByParent.get(comment.id) || []}
                  isActive={activeCommentId === comment.id || hoveredCommentId === comment.id}
                  isReplying={activeReplyId === comment.id}
                  replyDraft={replyDrafts[comment.id] || ''}
                  submitting={submitting}
                  onClick={() => setActiveCommentId(comment.id)}
                  onMouseEnter={() => setHoveredCommentId(comment.id)}
                  onMouseLeave={() => setHoveredCommentId((current) => current === comment.id ? null : current)}
                  onReply={() => setActiveReplyId(activeReplyId === comment.id ? null : comment.id)}
                  onResolve={() => resolveComment(comment.id)}
                  onReplyDraftChange={(value) => setReplyDrafts((prev) => ({ ...prev, [comment.id]: value }))}
                  onSubmitReply={() => submitReply(comment.id)}
                />
              ))}
            </div>
          </div>
        </aside>
      </div>


    </>
  );
}

function MiniList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-zinc-500">{title}</div>
      <ul className="space-y-1 text-xs text-zinc-600 dark:text-zinc-300">
        {items.map((item, index) => <li key={index}>• {item}</li>)}
      </ul>
    </div>
  );
}

function KeywordList({ title, items, tone }: { title: string; items: string[]; tone: 'green' | 'orange' }) {
  const cls = tone === 'green'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
    : 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800';
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-zinc-500">{title}</div>
      <div className="flex flex-wrap gap-1">
        {items.map((item) => <Badge key={item} className={cls}>{item}</Badge>)}
      </div>
    </div>
  );
}

function CommentCard({
  comment,
  replies,
  isActive,
  isReplying,
  replyDraft,
  submitting,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onReply,
  onResolve,
  onReplyDraftChange,
  onSubmitReply,
}: {
  comment: ReviewComment;
  replies: ReviewComment[];
  isActive: boolean;
  isReplying: boolean;
  replyDraft: string;
  submitting: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onReply: () => void;
  onResolve: () => void;
  onReplyDraftChange: (value: string) => void;
  onSubmitReply: () => void;
}) {
  const t = useTranslations('publicView');
  const isResolved = comment.status === 'resolved';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onClick();
      }}
      className={`border-b border-zinc-200 pb-3 text-sm outline-none transition-colors last:border-b-0 dark:border-zinc-800 ${isActive ? 'bg-brand-muted/60 dark:bg-brand-muted/20' : ''} ${isResolved ? 'opacity-55' : ''}`}
    >
      <div className="mb-2 flex items-center gap-2 px-1 pt-1">
        <Avatar size="sm">
          <AvatarFallback>{initials(comment.authorName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium text-zinc-700 dark:text-zinc-200">{comment.authorName}</div>
          <div className="text-[11px] text-zinc-400">{formatDate(comment.createdAt)}</div>
        </div>
        {isResolved && <span className="text-[11px] text-emerald-600">{t('resolved')}</span>}
      </div>

      <div className="px-1">
        {comment.selectedText && (
          <div className="mb-2 border-l-2 border-yellow-300/80 bg-yellow-50/40 px-2 py-1.5 text-xs text-yellow-800 dark:bg-yellow-500/10 dark:text-yellow-100">
            <div className="mb-0.5 font-medium">{t('selectedText')}</div>
            <div className="line-clamp-3">{comment.selectedText}</div>
          </div>
        )}
        <p className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-200">{comment.content}</p>
      </div>

      {replies.length > 0 && (
        <div className="mt-3 ml-7 space-y-2 border-l border-zinc-200 pl-3 dark:border-zinc-800">
          {replies.map((reply) => (
            <div key={reply.id} className="text-xs">
              <div className="mb-0.5 text-zinc-400">
                <span className="font-medium text-zinc-600 dark:text-zinc-300">{reply.authorName}</span>
                {' · '}{formatDate(reply.createdAt)}
              </div>
              <p className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-200">{reply.content}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-3 px-1 text-xs">
        <button type="button" onClick={(event) => { event.stopPropagation(); onReply(); }} className="cursor-pointer text-brand hover:underline">
          {t('reply')}
        </button>
        {!isResolved && (
          <button type="button" onClick={(event) => { event.stopPropagation(); onResolve(); }} className="cursor-pointer text-zinc-500 hover:text-emerald-600">
            {t('resolveComment')}
          </button>
        )}
      </div>

      {isReplying && (
        <div className="mt-3 space-y-2 px-1" onClick={(event) => event.stopPropagation()}>
          <Textarea
            value={replyDraft}
            onChange={(event) => onReplyDraftChange(event.target.value)}
            placeholder={t('replyPlaceholder')}
            className="min-h-20 text-sm"
          />
          <Button size="sm" onClick={onSubmitReply} disabled={submitting || !replyDraft.trim()} className="cursor-pointer bg-brand hover:bg-brand-hover">
            {submitting && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            {t('submitReply')}
          </Button>
        </div>
      )}
    </div>
  );
}
