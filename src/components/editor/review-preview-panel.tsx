'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Clock3, Loader2, MessageSquareText, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ReviewedResumeView, type ReviewAnchorForPreview, type ReviewCommentForPreview } from '@/components/share/reviewed-resume-view';
import { cn } from '@/lib/utils';
import type { Resume } from '@/types/resume';

type ReviewComment = {
  id: string;
  shareId: string;
  shareLabel?: string;
  parentCommentId?: string | null;
  authorName: string;
  authorEmail?: string | null;
  selectedText?: string | null;
  anchor?: ReviewAnchorForPreview | null;
  content: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type ShareSummary = {
  id: string;
  token: string;
  label: string;
  reviewEnabled: boolean;
  isActive: boolean;
  commentCount: number;
  lastCommentAt?: string | null;
  createdAt: string;
  updatedAt: string;
  comments: ReviewComment[];
};

type ReviewSummaryResponse = {
  shares: ShareSummary[];
  aggregate: {
    id: 'all';
    label: string;
    commentCount: number;
    lastCommentAt?: string | null;
    comments: ReviewComment[];
  };
};

export type ReviewOption = {
  id: string;
  label: string;
  commentCount: number;
  lastUpdated?: string | null;
  sharedAt?: string | null;
};

function getHeaders() {
  const fingerprint = typeof window !== 'undefined' ? localStorage.getItem('touchresume_fingerprint') : null;
  return fingerprint ? { 'x-fingerprint': fingerprint } : undefined;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleString(undefined, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function ReviewPreviewPanel({
  resumeId,
  resume,
  selectedReviewId = 'all',
  onReviewOptionsChange,
}: {
  resumeId: string;
  resume: Resume;
  selectedReviewId?: string;
  onReviewOptionsChange?: (options: ReviewOption[]) => void;
}) {
  const t = useTranslations('editor.reviewPreview');
  const [data, setData] = useState<ReviewSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/resume/${resumeId}/review-summary`, { headers: getHeaders(), cache: 'no-store' });
      if (res.ok) {
        const nextData = await res.json() as ReviewSummaryResponse;
        setData(nextData);
        onReviewOptionsChange?.([
          {
            id: 'all',
            label: `${t('aggregate')} · ${nextData.aggregate.commentCount}`,
            commentCount: nextData.aggregate.commentCount,
            lastUpdated: nextData.aggregate.lastCommentAt,
          },
          ...nextData.shares.map((share) => ({
            id: share.id,
            label: `${share.label || t('unnamedShare')} · ${share.commentCount}`,
            commentCount: share.commentCount,
            lastUpdated: share.lastCommentAt || share.updatedAt,
            sharedAt: share.createdAt,
          })),
        ]);
      }
    } finally {
      setLoading(false);
    }
  }, [onReviewOptionsChange, resumeId, t]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const selected = useMemo(() => {
    if (!data) return null;
    if (selectedReviewId === 'all') return data.aggregate;
    return data.shares.find((share) => share.id === selectedReviewId) || data.aggregate;
  }, [data, selectedReviewId]);

  const rootComments = useMemo(() => (selected?.comments || []).filter((comment) => !comment.parentCommentId), [selected]);
  const previewComments = useMemo<ReviewCommentForPreview[]>(
    () => rootComments.map((comment) => ({
      ...comment,
      shareLabel: comment.shareLabel || undefined,
    })),
    [rootComments]
  );
  const repliesByParent = useMemo(() => {
    const map = new Map<string, ReviewComment[]>();
    for (const comment of selected?.comments || []) {
      if (!comment.parentCommentId) continue;
      const list = map.get(comment.parentCommentId) || [];
      list.push(comment);
      map.set(comment.parentCommentId, list);
    }
    return map;
  }, [selected]);

  return (
    <div className="flex h-full min-w-0 border-l bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <main className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_360px] overflow-hidden">
        <div className="min-h-0 overflow-y-auto p-4">
          {loading && !data ? (
            <div className="flex h-full items-center justify-center text-zinc-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <ReviewedResumeView
              resume={resume}
              comments={previewComments}
              activeCommentId={activeCommentId}
              onActiveCommentChange={setActiveCommentId}
              className="mx-auto w-fit"
            />
          )}
        </div>

        <aside className="min-h-0 overflow-y-auto border-l bg-white/80 dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
            <div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{selected?.label || t('aggregate')}</div>
              <div className="text-xs text-zinc-500">{t('commentCount')}: {selected?.commentCount || 0}</div>
            </div>
            <Button variant="outline" size="sm" onClick={fetchSummary} disabled={loading} className="cursor-pointer gap-1.5 xl:hidden">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {t('refresh')}
            </Button>
          </div>

          <div className="space-y-3 p-4">
            {rootComments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-400">
                <MessageSquareText className="mb-3 h-10 w-10" />
                <p className="text-sm">{t('noComments')}</p>
              </div>
            ) : (
              rootComments.map((comment) => (
                <button
                  key={comment.id}
                  type="button"
                  onClick={() => setActiveCommentId(comment.id)}
                  className={cn(
                    'w-full rounded-xl border bg-white p-4 text-left shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-900',
                    activeCommentId === comment.id && 'border-brand bg-brand-muted/40 dark:border-brand'
                  )}
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{comment.authorName}</span>
                        {comment.shareLabel && selectedReviewId === 'all' && <Badge variant="secondary" className="text-[10px]">{comment.shareLabel}</Badge>}
                        {comment.status === 'resolved' && (
                          <Badge variant="outline" className="gap-1 text-[10px] text-emerald-600">
                            <CheckCircle2 className="h-3 w-3" />{t('resolved')}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-zinc-400">
                        <Clock3 className="h-3 w-3" />
                        {formatDate(comment.updatedAt || comment.createdAt)}
                      </div>
                    </div>
                  </div>
                  {comment.selectedText ? (
                    <blockquote className="mb-3 rounded-lg border-l-2 border-brand bg-brand-muted/40 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-300">
                      {comment.selectedText}
                    </blockquote>
                  ) : (
                    <div className="mb-3 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                      {t('noAnchor')}
                    </div>
                  )}
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">{comment.content}</p>
                  {(repliesByParent.get(comment.id) || []).length > 0 && (
                    <div className="mt-3 space-y-2 border-l pl-3 dark:border-zinc-700">
                      {(repliesByParent.get(comment.id) || []).map((reply) => (
                        <div key={reply.id} className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/60">
                          <div className="mb-1 text-xs font-semibold text-zinc-600 dark:text-zinc-300">{reply.authorName}</div>
                          <p className="whitespace-pre-wrap text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">{reply.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
