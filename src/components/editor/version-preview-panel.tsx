'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { GitBranch, Loader2, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PreviewZoom } from '@/components/preview/preview-zoom';
import { cn } from '@/lib/utils';
import { normalizeThemeConfig } from '@/lib/theme-config';
import type { Resume, ResumeVersion } from '@/types/resume';

type VersionRecord = Omit<ResumeVersion, 'createdAt'> & { createdAt: string };

export type VersionOption = {
  id: string;
  label: string;
  source: string;
  createdAt: string;
};

function getHeaders() {
  const fingerprint = typeof window !== 'undefined' ? localStorage.getItem('touchresume_fingerprint') : null;
  return fingerprint ? { 'x-fingerprint': fingerprint } : undefined;
}

function formatDate(value?: string | Date | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleString(undefined, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function normalizeSnapshot(snapshot: Resume): Resume {
  const sections = Array.isArray(snapshot.sections) ? snapshot.sections : [];
  return {
    ...snapshot,
    sections,
    themeConfig: normalizeThemeConfig(snapshot.themeConfig),
    createdAt: new Date(snapshot.createdAt || Date.now()),
    updatedAt: new Date(snapshot.updatedAt || Date.now()),
  } as Resume;
}

export function VersionPreviewPanel({
  resumeId,
  liveResume,
  selectedVersionId = 'live',
  onSelectedVersionIdChange,
  onVersionOptionsChange,
}: {
  resumeId: string;
  liveResume: Resume;
  selectedVersionId?: string;
  onSelectedVersionIdChange?: (id: string) => void;
  onVersionOptionsChange?: (versions: VersionOption[]) => void;
}) {
  const t = useTranslations('editor.versionPreview');
  const [versions, setVersions] = useState<VersionRecord[]>([]);
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<'all' | 'manual' | 'autosave' | 'ai'>('all');
  const [loading, setLoading] = useState(false);

  const fetchVersions = useCallback(async () => {
    if (resumeId.startsWith('local_')) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/resume/${resumeId}/versions`, { headers: getHeaders(), cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setVersions(data);
        onVersionOptionsChange?.(data.map((version: VersionRecord) => ({
          id: version.id,
          label: `${version.label} · ${formatDate(version.createdAt)}`,
          source: version.source,
          createdAt: version.createdAt,
        })));
      }
    } finally {
      setLoading(false);
    }
  }, [onVersionOptionsChange, resumeId]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  const filteredVersions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return versions.filter((version) => {
      if (source !== 'all' && version.source !== source) return false;
      if (!normalizedQuery) return true;
      return `${version.label} ${version.source}`.toLowerCase().includes(normalizedQuery);
    });
  }, [query, source, versions]);

  const selectedResume = useMemo(() => {
    if (selectedVersionId === 'live') return liveResume;
    const version = versions.find((item) => item.id === selectedVersionId);
    return version?.snapshot ? normalizeSnapshot(version.snapshot as Resume) : liveResume;
  }, [liveResume, selectedVersionId, versions]);

  return (
    <div className="flex h-full min-w-0 border-l bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <aside className="hidden w-80 shrink-0 flex-col border-r bg-white dark:border-zinc-800 dark:bg-zinc-900 xl:flex">
        <div className="border-b p-4 dark:border-zinc-800">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t('history')}</div>
              <div className="text-xs text-zinc-500">{t('historyHint')}</div>
            </div>
            <Button variant="ghost" size="icon" onClick={fetchVersions} disabled={loading || resumeId.startsWith('local_')} className="h-8 w-8 cursor-pointer">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
          <div className="mt-3 space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('search')} className="h-8 pl-8 text-xs" />
            </div>
            <div className="grid grid-cols-4 gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
              {(['all', 'manual', 'autosave', 'ai'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setSource(item)}
                  className={cn(
                    'rounded-md px-1 py-1 text-[11px] font-medium transition-colors',
                    source === item
                      ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100'
                  )}
                >
                  {t(`source.${item}`)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          <button
            type="button"
            onClick={() => onSelectedVersionIdChange?.('live')}
            className={cn(
              'w-full rounded-xl border p-3 text-left transition-colors',
              selectedVersionId === 'live'
                ? 'border-brand bg-brand-muted text-brand'
                : 'border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800'
            )}
          >
            <div className="text-sm font-semibold">{t('current')}</div>
            <div className="mt-1 text-xs text-zinc-500">{formatDate(liveResume.updatedAt)}</div>
          </button>

          {filteredVersions.map((version) => (
            <button
              key={version.id}
              type="button"
              onClick={() => onSelectedVersionIdChange?.(version.id)}
              className={cn(
                'w-full rounded-xl border p-3 text-left transition-colors',
                selectedVersionId === version.id
                  ? 'border-brand bg-brand-muted text-brand'
                  : 'border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800'
              )}
            >
              <div className="flex items-center gap-2">
                <GitBranch className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate text-sm font-semibold">{version.label}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-xs text-zinc-500">
                <span>{t(`source.${['manual', 'autosave', 'ai', 'jd'].includes(version.source) ? version.source : 'all'}`)}</span>
                <span>{formatDate(version.createdAt)}</span>
              </div>
            </button>
          ))}

          {!loading && filteredVersions.length === 0 && (
            <div className="rounded-xl border border-dashed p-6 text-center text-xs text-zinc-400 dark:border-zinc-800">
              {resumeId.startsWith('local_') ? t('localOnly') : t('empty')}
            </div>
          )}
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <PreviewZoom resume={selectedResume} title={selectedVersionId === 'live' ? t('current') : t('snapshot')} initialZoom={80} />
      </div>
    </div>
  );
}
