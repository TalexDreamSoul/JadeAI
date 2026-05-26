'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, CheckCircle2, Clock3, Loader2, MessageSquareText, RefreshCw, RotateCcw, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ReviewedResumeView, type ReviewAnchorForPreview, type ReviewCommentForPreview } from '@/components/share/reviewed-resume-view';
import { cn } from '@/lib/utils';
import type { Resume } from '@/types/resume';

type ChangeProposal = {
  id: string;
  status: string;
  source?: string | null;
  sourceId?: string | null;
  commentId?: string | null;
  sectionType: string;
  targetField: string;
  current: string;
  suggested: string;
  reason: string;
  evidenceRequired?: boolean;
};

type ReviewComment = {
  id: string;
  shareId: string;
  shareToken?: string;
  shareLabel?: string;
  parentCommentId?: string | null;
  authorName: string;
  authorEmail?: string | null;
  selectedText?: string | null;
  anchor?: ReviewAnchorForPreview | null;
  content: string;
  status: string;
  changeProposal?: ChangeProposal | null;
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

type ReviewStatusFilter = 'open' | 'resolved' | 'all';

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
  const [proposals, setProposals] = useState<ChangeProposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [previewZoom, setPreviewZoom] = useState(80);
  const [statusFilter, setStatusFilter] = useState<ReviewStatusFilter>('open');
  const [updatingCommentId, setUpdatingCommentId] = useState<string | null>(null);
  const [updatingProposalId, setUpdatingProposalId] = useState<string | null>(null);

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
      const proposalRes = await fetch(`/api/resume/${resumeId}/change-proposals`, { headers: getHeaders(), cache: 'no-store' });
      if (proposalRes.ok) {
        const nextProposals = await proposalRes.json();
        setProposals(Array.isArray(nextProposals) ? nextProposals : []);
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
  const filteredRootComments = useMemo(() => {
    if (statusFilter === 'all') return rootComments;
    return rootComments.filter((comment) => (comment.status === 'resolved') === (statusFilter === 'resolved'));
  }, [rootComments, statusFilter]);
  const previewComments = useMemo<ReviewCommentForPreview[]>(
    () => rootComments.map((comment) => ({
      ...comment,
      shareLabel: comment.shareLabel || undefined,
    })),
    [rootComments]
  );
  const standaloneProposals = useMemo(() => proposals.filter((proposal) => !proposal.commentId), [proposals]);
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
  const updateProposal = useCallback(async (proposal: ChangeProposal, action: 'apply' | 'reject' | 'undo') => {
    setUpdatingProposalId(proposal.id);
    try {
      const res = await fetch(`/api/resume/${resumeId}/change-proposals/${proposal.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(getHeaders() || {}),
        },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchSummary();
    } finally {
      setUpdatingProposalId(null);
    }
  }, [fetchSummary, resumeId]);

  const updateCommentStatus = useCallback(async (comment: ReviewComment, status: 'open' | 'resolved') => {
    if (!comment.shareToken) return;
    setUpdatingCommentId(comment.id);
    try {
      const res = await fetch(`/api/share/${comment.shareToken}/comments/${comment.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(getHeaders() || {}),
        },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json() as ReviewComment;
      setData((current) => {
        if (!current) return current;
        const updateList = (comments: ReviewComment[]) => comments.map((item) => (
          item.id === comment.id ? { ...item, ...updated, shareToken: item.shareToken, shareLabel: item.shareLabel } : item
        ));
        return {
          shares: current.shares.map((share) => ({ ...share, comments: updateList(share.comments) })),
          aggregate: { ...current.aggregate, comments: updateList(current.aggregate.comments) },
        };
      });
    } finally {
      setUpdatingCommentId(null);
    }
  }, []);

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
              className="h-full"
              enableZoom
              zoom={previewZoom}
              onZoomChange={setPreviewZoom}
            />
          )}
        </div>

        <aside className="min-h-0 overflow-y-auto border-l bg-white/80 dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="sticky top-0 z-10 border-b bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{selected?.label || t('aggregate')}</div>
              <div className="text-xs text-zinc-500">{t('commentCount')}: {selected?.commentCount || 0}</div>
            </div>
            <Button variant="outline" size="sm" onClick={fetchSummary} disabled={loading} className="cursor-pointer gap-1.5 xl:hidden">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {t('refresh')}
            </Button>
            </div>
            <div className="mt-3 grid grid-cols-3 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
              {(['open', 'resolved', 'all'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setStatusFilter(filter)}
                  className={cn(
                    'cursor-pointer rounded-md px-2 py-1 text-xs font-medium transition-colors',
                    statusFilter === filter
                      ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
                  )}
                >
                  {t(`status.${filter}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 p-4">
            {standaloneProposals.length > 0 && (
              <div className="mb-3 space-y-2 rounded-xl border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-900/60 dark:bg-violet-950/20">
                <div className="text-xs font-semibold text-violet-700 dark:text-violet-300">{t('changeProposals')}</div>
                {standaloneProposals.map((proposal) => (
                  <div key={proposal.id} className="rounded-lg bg-white p-3 shadow-sm dark:bg-zinc-900">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{proposal.source || 'AI'}</Badge>
                      <Badge variant="secondary">{proposal.sectionType}</Badge>
                      <Badge variant="secondary">{proposal.status}</Badge>
                    </div>
                    <p className="whitespace-pre-wrap text-xs leading-5 text-zinc-700 dark:text-zinc-200">{proposal.suggested}</p>
                    {proposal.reason && <p className="mt-2 text-xs text-zinc-500">{proposal.reason}</p>}
                    <div className="mt-3 flex justify-end gap-2">
                      {proposal.status === 'applied' ? (
                        <Button type="button" size="xs" variant="outline" disabled={updatingProposalId === proposal.id} onClick={() => updateProposal(proposal, 'undo')}>
                          {updatingProposalId === proposal.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                          {t('undoProposal')}
                        </Button>
                      ) : proposal.status === 'pending' ? (
                        <>
                          <Button type="button" size="xs" variant="outline" disabled={updatingProposalId === proposal.id} onClick={() => updateProposal(proposal, 'reject')}>
                            <X className="h-3 w-3" />
                            {t('rejectProposal')}
                          </Button>
                          <Button type="button" size="xs" disabled={updatingProposalId === proposal.id} onClick={() => updateProposal(proposal, 'apply')} className="bg-brand hover:bg-brand-hover">
                            {updatingProposalId === proposal.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                            {t('applyProposal')}
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {filteredRootComments.length === 0 ? (
              standaloneProposals.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-400">
                  <MessageSquareText className="mb-3 h-10 w-10" />
                  <p className="text-sm">{t('noComments')}</p>
                </div>
              )
            ) : (
              filteredRootComments.map((comment) => (
                <div
                  key={comment.id}
                  onClick={() => setActiveCommentId(comment.id)}
                  className={cn(
                    'w-full cursor-pointer rounded-xl border bg-white p-4 text-left shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-900',
                    activeCommentId === comment.id && 'border-brand bg-brand-muted/40 dark:border-brand',
                    comment.status === 'resolved' && 'opacity-70'
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
                    <Button
                      type="button"
                      variant={comment.status === 'resolved' ? 'outline' : 'secondary'}
                      size="sm"
                      disabled={updatingCommentId === comment.id}
                      className="h-7 shrink-0 cursor-pointer gap-1 px-2 text-xs"
                      onClick={(event) => {
                        event.stopPropagation();
                        updateCommentStatus(comment, comment.status === 'resolved' ? 'open' : 'resolved');
                      }}
                    >
                      {updatingCommentId === comment.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : comment.status === 'resolved' ? (
                        <RotateCcw className="h-3 w-3" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3" />
                      )}
                      {comment.status === 'resolved' ? t('reopen') : t('resolve')}
                    </Button>
                  </div>
                  {comment.selectedText ? (
                    <blockquote className="mb-3 rounded-lg border border-dashed border-brand/50 bg-brand-muted/30 px-3 py-2 text-xs text-zinc-600 dark:border-brand/60 dark:text-zinc-300">
                      {comment.selectedText}
                    </blockquote>
                  ) : null}
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">{comment.content}</p>
                  {comment.changeProposal && (
                    <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50/70 p-3 text-xs dark:border-violet-900/60 dark:bg-violet-950/20">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-violet-700 dark:text-violet-300">{t('changeProposal')}</Badge>
                        <Badge variant="secondary">{comment.changeProposal.sectionType}</Badge>
                        <Badge variant="secondary">{comment.changeProposal.status}</Badge>
                      </div>
                      <div className="grid gap-2">
                        <div>
                          <p className="mb-1 font-semibold text-zinc-500">{t('suggestedChange')}</p>
                          <p className="whitespace-pre-wrap leading-5 text-zinc-700 dark:text-zinc-200">{comment.changeProposal.suggested}</p>
                        </div>
                        {comment.changeProposal.reason && <p className="text-zinc-500">{comment.changeProposal.reason}</p>}
                      </div>
                      <div className="mt-3 flex justify-end gap-2">
                        {comment.changeProposal.status === 'applied' ? (
                          <Button type="button" size="xs" variant="outline" disabled={updatingProposalId === comment.changeProposal.id} onClick={(event) => { event.stopPropagation(); updateProposal(comment.changeProposal!, 'undo'); }}>
                            {updatingProposalId === comment.changeProposal.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                            {t('undoProposal')}
                          </Button>
                        ) : comment.changeProposal.status === 'pending' ? (
                          <>
                            <Button type="button" size="xs" variant="outline" disabled={updatingProposalId === comment.changeProposal.id} onClick={(event) => { event.stopPropagation(); updateProposal(comment.changeProposal!, 'reject'); }}>
                              <X className="h-3 w-3" />
                              {t('rejectProposal')}
                            </Button>
                            <Button type="button" size="xs" disabled={updatingProposalId === comment.changeProposal.id} onClick={(event) => { event.stopPropagation(); updateProposal(comment.changeProposal!, 'apply'); }} className="bg-brand hover:bg-brand-hover">
                              {updatingProposalId === comment.changeProposal.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                              {t('applyProposal')}
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  )}
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
                </div>
              ))
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
