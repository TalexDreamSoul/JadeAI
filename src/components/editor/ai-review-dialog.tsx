'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, WandSparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getAIHeaders } from '@/stores/settings-store';
import { useResumeStore } from '@/stores/resume-store';
import { isLocalResumeId } from '@/lib/local-resumes';
import { safeParseJson } from '@/lib/safe-json';

interface AIReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resumeId: string;
}

interface ReviewResult {
  score: number;
  summary: string;
  strengths: string[];
  risks: string[];
  actions: { section: string; priority: string; suggestion: string }[];
}

interface ReviewHistoryItem {
  id: string;
  score: number;
  result: ReviewResult | null;
  status?: 'pending' | 'success' | 'failed';
  error?: string;
  createdAt: string | number | Date;
}

interface ReviewHistoryRow {
  id: string;
  score?: number | null;
  result?: unknown;
  status?: 'pending' | 'success' | 'failed';
  error?: string | null;
  createdAt: string | number | Date;
}

function authHeaders() {
  const fingerprint = typeof window !== 'undefined' ? localStorage.getItem('touchresume_fingerprint') : null;
  return {
    'Content-Type': 'application/json',
    ...getAIHeaders(),
    ...(fingerprint ? { 'x-fingerprint': fingerprint } : {}),
  };
}

function formatDate(value: string | number | Date) {
  const date = typeof value === 'number' && value < 10_000_000_000 ? new Date(value * 1000) : new Date(value);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function AIReviewDialog({ open, onOpenChange, resumeId }: AIReviewDialogProps) {
  const t = useTranslations('aiReview');
  const currentResume = useResumeStore((s) => s.currentResume);
  const isLocalResume = isLocalResumeId(resumeId);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [history, setHistory] = useState<ReviewHistoryItem[]>([]);
  const [error, setError] = useState('');

  const fetchHistory = async (options?: { silent?: boolean }) => {
    if (isLocalResume) return;
    if (!options?.silent) setHistoryLoading(true);
    try {
      const res = await fetch(`/api/resume/${resumeId}/ai-review`, { headers: authHeaders() });
      if (!res.ok) return;
      const rows = await res.json();
      setHistory((Array.isArray(rows) ? rows : []).map((row: ReviewHistoryRow) => {
        const parsed = safeParseJson<ReviewResult | null>(row.result, null);
        return {
          id: row.id,
          score: row.score || 0,
          result: parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0 ? parsed : null,
          status: row.status || 'success',
          error: row.error || undefined,
          createdAt: row.createdAt,
        };
      }));
    } finally {
      if (!options?.silent) setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (open) void fetchHistory({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resumeId]);

  const run = async () => {
    setLoading(true);
    setError('');
    try {
      const endpoint = isLocalResume ? '/api/ai/resume-review' : `/api/resume/${resumeId}/ai-review`;
      const body = isLocalResume
        ? { resumeId, focus: 'overall', resume: currentResume }
        : { focus: 'overall' };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        await fetchHistory({ silent: true });
        throw new Error(data.error || t('failed'));
      }
      setResult(data);
      await fetchHistory({ silent: true });
    } catch (err) {
      await fetchHistory({ silent: true });
      setError(err instanceof Error ? err.message : t('failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WandSparkles className="h-4 w-4 text-brand" />
            {t('title')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Button onClick={run} disabled={loading} className="cursor-pointer bg-brand hover:bg-brand-hover">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('run')}
          </Button>
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">{error}</p>}
          {!isLocalResume && (
            <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{t('history')}</h3>
                <Button type="button" size="sm" variant="ghost" onClick={() => fetchHistory()} className="h-7 px-2 text-xs">
                  {t('refresh')}
                </Button>
              </div>
              {historyLoading ? (
                <Loader2 className="mx-auto h-4 w-4 animate-spin text-zinc-400" />
              ) : history.length === 0 ? (
                <p className="text-xs text-zinc-400">{t('noHistory')}</p>
              ) : (
                <div className="space-y-2">
                  {history.slice(0, 5).map((item) => {
                    const failed = item.status === 'failed';
                    const pending = item.status === 'pending';
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => item.result && setResult(item.result)}
                        disabled={!item.result}
                        className={`w-full rounded-md border px-3 py-2 text-left text-xs transition disabled:cursor-default ${failed ? 'border-red-100 bg-red-50 text-red-600 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400' : 'border-zinc-100 bg-white hover:border-brand dark:border-zinc-800 dark:bg-zinc-900'}`}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className={failed ? 'font-semibold text-red-600 dark:text-red-400' : pending ? 'font-semibold text-amber-600 dark:text-amber-400' : 'font-semibold text-brand'}>
                            {failed ? t('failedStatus') : pending ? t('pendingStatus') : item.score}
                          </span>
                          <span className="text-[10px] text-zinc-400">{formatDate(item.createdAt)}</span>
                        </div>
                        <p className="line-clamp-3 whitespace-pre-wrap text-zinc-500 dark:text-zinc-400">
                          {failed ? item.error || t('failed') : pending ? t('pendingStatus') : item.result?.summary}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {result && (
            <div className="space-y-4 text-sm">
              <div className="rounded-lg border p-3">
                <div className="mb-1 text-2xl font-bold text-brand">{result.score}</div>
                <p className="text-zinc-600 dark:text-zinc-300">{result.summary}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <h3 className="mb-2 font-semibold">{t('strengths')}</h3>
                  <ul className="space-y-1 text-zinc-600 dark:text-zinc-300">
                    {result.strengths.map((item, index) => <li key={index}>- {item}</li>)}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-2 font-semibold">{t('risks')}</h3>
                  <ul className="space-y-1 text-zinc-600 dark:text-zinc-300">
                    {result.risks.map((item, index) => <li key={index}>- {item}</li>)}
                  </ul>
                </div>
              </div>
              <div>
                <h3 className="mb-2 font-semibold">{t('actions')}</h3>
                <div className="space-y-2">
                  {result.actions.map((item, index) => (
                    <div key={index} className="rounded-md bg-zinc-50 p-2 dark:bg-zinc-800">
                      <div className="text-xs font-medium text-zinc-500">{item.section} · {item.priority}</div>
                      <p>{item.suggestion}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
