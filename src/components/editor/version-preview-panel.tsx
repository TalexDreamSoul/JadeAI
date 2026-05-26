'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Copy, GitBranch, Loader2, RefreshCw, RotateCcw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PreviewZoom } from '@/components/preview/preview-zoom';
import { cn } from '@/lib/utils';
import { normalizeThemeConfig } from '@/lib/theme-config';
import { diffResumes, type ResumeVersionDiff } from '@/lib/resume-version-utils';
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

function safeSourceKey(source: string) {
  return ['manual', 'autosave', 'ai', 'jd', 'mcp'].includes(source) ? source : 'all';
}

type DiffLabels = {
  changed: string;
  added: string;
  removed: string;
  meta: string;
  noChanges: string;
};

function diffSummaryText(diff: ResumeVersionDiff, labels: DiffLabels) {
  const parts = [
    diff.summary.changed ? `${diff.summary.changed} ${labels.changed}` : '',
    diff.summary.added ? `${diff.summary.added} ${labels.added}` : '',
    diff.summary.removed ? `${diff.summary.removed} ${labels.removed}` : '',
    diff.summary.metadataCount ? `${diff.summary.metadataCount} ${labels.meta}` : '',
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : labels.noChanges;
}

function sourceBadgeClass(source: string) {
  if (source === 'autosave') return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300';
  if (source === 'ai') return 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300';
  if (source === 'jd') return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300';
  if (source === 'mcp') return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300';
  return 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300';
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
  const [source, setSource] = useState<'all' | 'manual' | 'autosave' | 'ai' | 'jd' | 'mcp'>('all');
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const diffLabels = useMemo<DiffLabels>(() => ({
    changed: t('diff.changed'),
    added: t('diff.added'),
    removed: t('diff.removed'),
    meta: t('diff.meta'),
    noChanges: t('diff.noChanges'),
  }), [t]);

  const fetchVersions = useCallback(async () => {
    if (resumeId.startsWith('local_')) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/resume/${resumeId}/versions`, { headers: getHeaders(), cache: 'no-store' });
      if (res.ok) {
        const data = await res.json() as VersionRecord[];
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

  const selectedVersion = useMemo(() => versions.find((item) => item.id === selectedVersionId) || null, [selectedVersionId, versions]);

  const selectedResume = useMemo(() => {
    if (selectedVersionId === 'live') return liveResume;
    return selectedVersion?.snapshot ? normalizeSnapshot(selectedVersion.snapshot as Resume) : liveResume;
  }, [liveResume, selectedVersion, selectedVersionId]);

  const selectedDiff = useMemo(() => {
    if (selectedVersionId === 'live' || !selectedVersion?.snapshot) return null;
    return diffResumes(normalizeSnapshot(selectedVersion.snapshot as Resume), liveResume);
  }, [liveResume, selectedVersion, selectedVersionId]);

  const versionDiffs = useMemo(() => new Map(versions.map((version) => [
    version.id,
    version.snapshot ? diffResumes(normalizeSnapshot(version.snapshot as Resume), liveResume) : null,
  ])), [liveResume, versions]);
  const changeTypeLabels = useMemo<Record<'added' | 'removed' | 'changed', string>>(() => ({
    added: t('diff.added'),
    removed: t('diff.removed'),
    changed: t('diff.changed'),
  }), [t]);

  const restoreSelectedVersion = useCallback(async (version = selectedVersion) => {
    if (!version || restoring) return;
    const confirmed = window.confirm(t('restoreConfirm'));
    if (!confirmed) return;
    setRestoring(true);
    try {
      const res = await fetch(`/api/resume/${resumeId}/versions`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(getHeaders() || {}),
        },
        body: JSON.stringify({ versionId: version.id }),
      });
      if (!res.ok) throw new Error(await res.text());
      window.location.reload();
    } catch (error) {
      console.error(error);
      window.alert(t('restoreFailed'));
    } finally {
      setRestoring(false);
    }
  }, [restoring, resumeId, selectedVersion, t]);

  const duplicateSelectedVersion = useCallback(async (version = selectedVersion) => {
    if (!version || duplicating) return;
    setDuplicating(true);
    try {
      const res = await fetch(`/api/resume/${resumeId}/versions`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(getHeaders() || {}),
        },
        body: JSON.stringify({ versionId: version.id, action: 'duplicate' }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json().catch(() => ({}));
      if (data.resume?.id) {
        const localeMatch = window.location.pathname.match(/^\/([^/]+)\//);
        const prefix = localeMatch?.[1] ? `/${localeMatch[1]}` : '';
        window.location.href = `${prefix}/editor/${data.resume.id}`;
      }
      else await fetchVersions();
    } catch (error) {
      console.error(error);
      window.alert(t('duplicateFailed'));
    } finally {
      setDuplicating(false);
    }
  }, [duplicating, fetchVersions, resumeId, selectedVersion, t]);

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
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
              {(['all', 'manual', 'autosave', 'ai', 'jd', 'mcp'] as const).map((item) => (
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

          {filteredVersions.map((version) => {
            const diff = versionDiffs.get(version.id);
            return (
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
              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-zinc-500">
                <Badge variant="outline" className={cn('text-[10px]', sourceBadgeClass(version.source))}>{t(`source.${safeSourceKey(version.source)}`)}</Badge>
                <span>{formatDate(version.createdAt)}</span>
              </div>
              {diff && (
                <div className="mt-2 truncate text-[11px] text-zinc-400">
                  {diffSummaryText(diff, diffLabels)}
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5 border-t pt-2 dark:border-zinc-800">
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(event) => { event.stopPropagation(); void restoreSelectedVersion(version); }}
                  onKeyDown={(event) => { if (event.key === 'Enter') { event.stopPropagation(); void restoreSelectedVersion(version); } }}
                  className="rounded-md px-2 py-1 text-[11px] text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                >
                  {t('restore')}
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(event) => { event.stopPropagation(); void duplicateSelectedVersion(version); }}
                  onKeyDown={(event) => { if (event.key === 'Enter') { event.stopPropagation(); void duplicateSelectedVersion(version); } }}
                  className="rounded-md px-2 py-1 text-[11px] text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                >
                  {t('duplicate')}
                </span>
              </div>
            </button>
          );})}

          {!loading && filteredVersions.length === 0 && (
            <div className="rounded-xl border border-dashed p-6 text-center text-xs text-zinc-400 dark:border-zinc-800">
              {resumeId.startsWith('local_') ? t('localOnly') : t('empty')}
            </div>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {selectedVersion && (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-white px-4 py-2 dark:border-zinc-800 dark:bg-background">
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-zinc-700 dark:text-zinc-200">{selectedVersion.label}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                <Badge variant="outline" className={cn('text-[10px]', sourceBadgeClass(selectedVersion.source))}>{t(`source.${safeSourceKey(selectedVersion.source)}`)}</Badge>
                <span>{formatDate(selectedVersion.createdAt)}</span>
                {selectedDiff && <span>{diffSummaryText(selectedDiff, diffLabels)}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={duplicating} onClick={() => duplicateSelectedVersion()} className="h-8 cursor-pointer gap-1.5 text-xs">
                {duplicating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                {t('duplicate')}
              </Button>
              <Button size="sm" variant="outline" disabled={restoring} onClick={() => restoreSelectedVersion()} className="h-8 cursor-pointer gap-1.5 text-xs">
                {restoring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                {t('restore')}
              </Button>
            </div>
          </div>
        )}
        {selectedDiff && (selectedDiff.summary.added || selectedDiff.summary.removed || selectedDiff.summary.changed || selectedDiff.summary.metadataCount) ? (
          <div className="shrink-0 border-b bg-amber-50/70 px-4 py-2 text-xs text-amber-800 dark:border-zinc-800 dark:bg-amber-950/20 dark:text-amber-200">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="min-w-0">
                <div className="font-medium">{t('diffTitle')}</div>
                <div className="mt-0.5 line-clamp-2">{selectedDiff.sectionChanges.slice(0, 3).map((change) => `${change.sectionTitle || change.sectionType}: ${changeTypeLabels[change.changeType]}`).join(' · ') || diffSummaryText(selectedDiff, diffLabels)}</div>
              </div>
            </div>
          </div>
        ) : null}
        <div className="min-h-0 flex-1">
          <PreviewZoom resume={selectedResume} title={selectedVersionId === 'live' ? t('current') : t('snapshot')} initialZoom={80} />
        </div>
      </div>
    </div>
  );
}
