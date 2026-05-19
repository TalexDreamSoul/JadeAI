'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, X, RefreshCw, Star, Code2, Loader2, WandSparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { EditableText } from '../fields/editable-text';
import { EditableRichText } from '../fields/editable-rich-text';
import { generateId } from '@/lib/utils';
import { getAIHeaders } from '@/stores/settings-store';
import { useResumeStore } from '@/stores/resume-store';
import type { ResumeSection, GitHubContent, GitHubRepoItem } from '@/types/resume';

const GITHUB_REPO_RE = /github\.com\/[^/]+\/[^/]+/;

function getJsonHeaders(includeAI = false) {
  const fingerprint = typeof window !== 'undefined' ? localStorage.getItem('touchresume_fingerprint') : null;
  return {
    'Content-Type': 'application/json',
    ...(fingerprint ? { 'x-fingerprint': fingerprint } : {}),
    ...(includeAI ? getAIHeaders() : {}),
  };
}

interface Props {
  section: ResumeSection;
  onUpdate: (content: Partial<GitHubContent>) => void;
}

export function GitHubSection({ section, onUpdate }: Props) {
  const t = useTranslations('editor.fields');
  const content = section.content as GitHubContent;
  const items = content.items || [];
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [summaryIds, setSummaryIds] = useState<Set<string>>(new Set());
  const [importUrl, setImportUrl] = useState('');
  const [importToken, setImportToken] = useState('');
  const [importing, setImporting] = useState(false);
  const currentResume = useResumeStore((state) => state.currentResume);
  const setResume = useResumeStore((state) => state.setResume);
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Keep a ref to always access the latest items, avoiding stale closures in setTimeout
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const addItem = () => {
    const newItem: GitHubRepoItem = {
      id: generateId(),
      repoUrl: '',
      name: '',
      stars: 0,
      language: '',
      description: '',
    };
    onUpdate({ items: [...items, newItem] });
  };

  const updateItem = (index: number, data: Partial<GitHubRepoItem>) => {
    const latest = itemsRef.current;
    const updated = latest.map((item, i) => (i === index ? { ...item, ...data } : item));
    onUpdate({ items: updated });
  };

  const removeItem = (index: number) => {
    const item = items[index];
    const timer = debounceTimers.current.get(item.id);
    if (timer) clearTimeout(timer);
    debounceTimers.current.delete(item.id);
    onUpdate({ items: items.filter((_, i) => i !== index) });
  };

  const fetchRepo = async (index: number, url: string) => {
    const latest = itemsRef.current;
    const item = latest[index];
    if (!item) return;
    setLoadingIds((prev) => new Set(prev).add(item.id));
    try {
      const res = await fetch(`/api/github/repo?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const data = await res.json();
        updateItem(index, {
          name: data.name,
          stars: data.stars,
          language: data.language,
          description: data.description,
        });
      }
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const summarizeRepo = async (index: number) => {
    const item = itemsRef.current[index];
    if (!item) return;
    setSummaryIds((prev) => new Set(prev).add(item.id));
    try {
      const res = await fetch('/api/github/repo/summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAIHeaders(),
        },
        body: JSON.stringify({
          repo: item,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        updateItem(index, {
          name: data.name || item.name,
          language: data.technologies?.[0] || item.language,
          description: [
            data.description,
            ...(Array.isArray(data.highlights) ? data.highlights.map((h: string) => `- ${h}`) : []),
          ].filter(Boolean).join('\n'),
        });
      }
    } finally {
      setSummaryIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const handleUrlChange = (index: number, value: string) => {
    const item = items[index];
    updateItem(index, { repoUrl: value });

    const prev = debounceTimers.current.get(item.id);
    if (prev) clearTimeout(prev);

    if (GITHUB_REPO_RE.test(value)) {
      const timer = setTimeout(() => {
        debounceTimers.current.delete(item.id);
        fetchRepo(index, value);
      }, 600);
      debounceTimers.current.set(item.id, timer);
    }
  };

  const importProject = async () => {
    const repoUrl = importUrl.trim();
    if (!currentResume?.id || !repoUrl) {
      toast.error(t('missingRepoUrl'));
      return;
    }

    setImporting(true);
    try {
      const res = await fetch('/api/career/github-project', {
        method: 'POST',
        headers: getJsonHeaders(true),
        body: JSON.stringify({
          resumeId: currentResume.id,
          repoUrl,
          token: importToken.trim() || undefined,
          targetRole: currentResume.targetJobTitle || '',
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (data.resume) setResume(data.resume);
      setImportUrl('');
      setImportToken('');
      toast.success(t('githubImportDone'));
    } catch (error) {
      console.error(error);
      toast.error(t('githubImportFailed'));
    } finally {
      setImporting(false);
    }
  };

  // Auto-refresh stars for all repos on mount
  const didAutoRefresh = useRef(false);
  useEffect(() => {
    if (didAutoRefresh.current) return;
    didAutoRefresh.current = true;
    const current = itemsRef.current;
    current.forEach((item, index) => {
      if (item.repoUrl && GITHUB_REPO_RE.test(item.repoUrl)) {
        fetch(`/api/github/repo?url=${encodeURIComponent(item.repoUrl)}`)
          .then((res) => res.ok ? res.json() : null)
          .then((data) => { if (data) updateItem(index, { stars: data.stars }); })
          .catch(() => {});
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-dashed border-brand/35 bg-brand-muted/30 p-3 dark:border-brand/40">
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,180px)_auto]">
          <Input
            value={importUrl}
            onChange={(event) => setImportUrl(event.target.value)}
            placeholder="https://github.com/owner/repo"
            className="h-9 bg-white dark:bg-zinc-900"
          />
          <Input
            value={importToken}
            onChange={(event) => setImportToken(event.target.value)}
            placeholder={t('githubTokenOptional')}
            type="password"
            autoComplete="off"
            className="h-9 bg-white dark:bg-zinc-900"
          />
          <Button
            type="button"
            size="sm"
            onClick={importProject}
            disabled={importing}
            className="h-9 cursor-pointer gap-1.5 bg-brand hover:bg-brand-hover"
          >
            {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            {t('quickImport')}
          </Button>
        </div>
      </div>
      {items.map((item, index) => (
        <div key={item.id || `gh-${index}`}>
          {index > 0 && <Separator className="mb-4" />}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">#{index + 1}</span>
              <Button variant="ghost" size="sm" className="h-7 cursor-pointer p-1 text-zinc-400 hover:text-red-500" onClick={() => removeItem(index)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="relative">
              <EditableText
                label={t('repoUrl')}
                value={item.repoUrl}
                onChange={(v) => handleUrlChange(index, v)}
              />
              {loadingIds.has(item.id) && (
                <Loader2 className="absolute right-2 top-7 h-4 w-4 animate-spin text-zinc-400" />
              )}
            </div>
            {item.name && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">{item.name}</span>
                {item.stars > 0 && (
                  <span className="inline-flex items-center gap-0.5">
                    <Star className="h-3 w-3 text-amber-500" />
                    {item.stars.toLocaleString()}
                  </span>
                )}
                {item.language && (
                  <span className="inline-flex items-center gap-0.5">
                    <Code2 className="h-3 w-3" />
                    {item.language}
                  </span>
                )}
                <button
                  type="button"
                  className="inline-flex cursor-pointer items-center gap-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  onClick={() => fetchRepo(index, item.repoUrl)}
                  disabled={loadingIds.has(item.id)}
                >
                  <RefreshCw className={`h-3 w-3 ${loadingIds.has(item.id) ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  className="inline-flex cursor-pointer items-center gap-0.5 text-zinc-400 hover:text-brand"
                  onClick={() => summarizeRepo(index)}
                  disabled={summaryIds.has(item.id)}
                  title={t('generateProjectIntro')}
                >
                  <WandSparkles className={`h-3 w-3 ${summaryIds.has(item.id) ? 'animate-pulse' : ''}`} />
                </button>
              </div>
            )}
            <EditableRichText label={t('description')} value={item.description} onChange={(v) => updateItem(index, { description: v })} />
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addItem} className="w-full cursor-pointer gap-1">
        <Plus className="h-3.5 w-3.5" />
        {t('addItem')}
      </Button>
    </div>
  );
}
