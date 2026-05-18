'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, WandSparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getAIHeaders } from '@/stores/settings-store';
import { useResumeStore } from '@/stores/resume-store';
import { isLocalResumeId } from '@/lib/local-resumes';

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

function authHeaders() {
  const fingerprint = typeof window !== 'undefined' ? localStorage.getItem('touchresume_fingerprint') : null;
  return {
    'Content-Type': 'application/json',
    ...getAIHeaders(),
    ...(fingerprint ? { 'x-fingerprint': fingerprint } : {}),
  };
}

export function AIReviewDialog({ open, onOpenChange, resumeId }: AIReviewDialogProps) {
  const t = useTranslations('aiReview');
  const currentResume = useResumeStore((s) => s.currentResume);
  const isLocalResume = isLocalResumeId(resumeId);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [error, setError] = useState('');

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
      if (!res.ok) throw new Error(data.error || t('failed'));
      setResult(data);
    } catch (err) {
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
          {error && <p className="text-sm text-red-500">{error}</p>}
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
