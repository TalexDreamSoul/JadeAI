'use client';

import { use, useState, useEffect, useCallback } from 'react';
import { signIn } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Lock, FileX2, Download, LogIn, Settings, WifiOff } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { PublicResumeReview } from '@/components/share/public-resume-review';
import { SettingsDialog } from '@/components/settings/settings-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUIStore } from '@/stores/ui-store';
import { useAuth } from '@/hooks/use-auth';
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

type PublicResume = Resume & { shareMeta?: ShareMeta };

export default function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const t = useTranslations('publicView');

  const [resume, setResume] = useState<PublicResume | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [offline, setOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { openModal } = useUIStore();
  const { user } = useAuth();
  const displayName = user?.name || user?.email || t('visitorFallback');

  const getHeaders = () => {
    const fingerprint = typeof window !== 'undefined' ? localStorage.getItem('touchresume_fingerprint') : null;
    return fingerprint ? { 'x-fingerprint': fingerprint } : undefined;
  };

  const clearSensitiveShareState = useCallback(() => {
    setResume(null);
    setNeedsPassword(false);
    setNeedsLogin(false);
    setPasswordError(false);
  }, []);

  const purgeSharePageCaches = useCallback(async () => {
    if (typeof window === 'undefined') return;

    try {
      sessionStorage.clear();
    } catch { /* ignore */ }

    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (key.startsWith('touchresume_share') || key.startsWith(`share:${token}`)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch { /* ignore */ }

    try {
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(
          names
            .filter((name) => name.includes('share') || name.includes('resume'))
            .map((name) => caches.delete(name))
        );
      }
    } catch { /* ignore */ }
  }, [token]);

  const fetchResume = useCallback(async (pwd?: string, options?: { silent?: boolean; poll?: boolean }) => {
    if (!options?.silent) setLoading(true);
    if (options?.silent) setRefreshing(true);
    setPasswordError(false);
    setNeedsLogin(false);

    try {
      const query = new URLSearchParams();
      if (pwd) query.set('password', pwd);
      if (options?.poll) query.set('poll', '1');
      const queryString = query.toString();
      const url = queryString ? `/api/share/${token}?${queryString}` : `/api/share/${token}`;

      const res = await fetch(url, {
        headers: getHeaders(),
        cache: 'no-store',
      });

      if (res.status === 404 || res.status === 403) {
        setNotFound(true);
        setOffline(false);
        setLoading(false);
        return;
      }

      if (res.status === 401) {
        const data = await res.json();
        if (data.passwordRequired) {
          if (pwd) setPasswordError(true);
          setNeedsPassword(true);
          setLoading(false);
          return;
        }
        if (data.loginRequired) {
          setNeedsLogin(true);
          setLoading(false);
          return;
        }
      }

      if (!res.ok) {
        setNotFound(true);
        setOffline(false);
        setLoading(false);
        return;
      }

      const data = await res.json();
      setResume(data);
      setNeedsPassword(false);
      setOffline(false);
      setNotFound(false);
    } catch {
      clearSensitiveShareState();
      await purgeSharePageCaches();
      setOffline(true);
      setNotFound(false);
    } finally {
      if (!options?.silent) setLoading(false);
      setRefreshing(false);
      setSubmitting(false);
    }
  }, [clearSensitiveShareState, purgeSharePageCaches, token]);

  useEffect(() => {
    fetchResume();
  }, [fetchResume]);

  useEffect(() => {
    if (!resume || needsPassword || needsLogin) return;
    const interval = window.setInterval(() => {
      fetchResume(password || undefined, { silent: true, poll: true });
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [fetchResume, needsLogin, needsPassword, password, resume]);

  useEffect(() => {
    const handleOffline = () => {
      clearSensitiveShareState();
      purgeSharePageCaches();
      setOffline(true);
      setLoading(false);
    };
    const handleOnline = () => {
      setOffline(false);
      fetchResume(password || undefined);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [clearSensitiveShareState, fetchResume, password, purgeSharePageCaches]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setSubmitting(true);
    fetchResume(password);
  };

  if (loading && !needsPassword) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  if (offline) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 text-center dark:bg-zinc-950">
        <div className="w-full max-w-sm space-y-5 rounded-xl border border-zinc-200 bg-white p-8 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
            <WifiOff className="h-6 w-6 text-zinc-500" />
          </div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t('offlineTitle')}</h1>
          <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{t('offlineDescription')}</p>
          <Button onClick={() => fetchResume(password || undefined)} className="w-full cursor-pointer bg-brand hover:bg-brand-hover">
            {t('retry')}
          </Button>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <FileX2 className="h-16 w-16 text-zinc-300 dark:text-zinc-600 mb-4" />
        <h1 className="text-xl font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
          {t('notFound')}
        </h1>
        <Link href="/dashboard" className="mt-4 text-sm text-brand hover:text-brand">
          {t('viewOnTouchResume')}
        </Link>
      </div>
    );
  }

  if (needsLogin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-full max-w-sm space-y-5 rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-muted dark:bg-brand-muted">
            <LogIn className="h-6 w-6 text-brand" />
          </div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t('loginToReview')}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('loginRequired')}</p>
          <Button onClick={() => signIn(undefined, { callbackUrl: window.location.href })} className="w-full cursor-pointer bg-brand hover:bg-brand-hover">
            {t('loginToReview')}
          </Button>
        </div>
      </div>
    );
  }

  if (needsPassword) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-full max-w-sm space-y-6 rounded-xl border border-zinc-200 bg-white p-8 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-muted dark:bg-brand-muted">
              <Lock className="h-6 w-6 text-brand" />
            </div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {t('passwordRequired')}
            </h1>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder={t('passwordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="text-sm"
              autoFocus
            />
            {passwordError && <p className="text-sm text-red-500">{t('invalidPassword')}</p>}
            <Button
              type="submit"
              disabled={submitting || !password.trim()}
              className="w-full cursor-pointer bg-brand hover:bg-brand-hover"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('submit')}
            </Button>
          </form>
        </div>

        <Link href="/dashboard" className="mt-6 text-sm text-brand hover:text-brand">
          {t('viewOnTouchResume')}
        </Link>
      </div>
    );
  }

  if (resume) {
    const shareMeta: ShareMeta = resume.shareMeta || {
      reviewEnabled: false,
      downloadEnabled: true,
      viewRequiresLogin: false,
      anonymousShare: false,
      hideSensitiveInfo: false,
    };

    return (
      <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950">
        <div className="flex h-full w-full flex-col overflow-hidden">
        <div className="z-30 flex shrink-0 items-center justify-between gap-2 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-sm font-semibold text-brand">TouchResume</span>
            <span className="shrink-0 text-xs text-zinc-400">|</span>
            <span className="truncate text-sm text-zinc-600 dark:text-zinc-400">{resume.title}</span>
            {refreshing && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-300" />}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {shareMeta.downloadEnabled && (
              <a
                href={`/api/share/${token}/download?format=pdf${password ? `&password=${encodeURIComponent(password)}` : ''}`}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <Download className="h-4 w-4" />
                {t('download')}
              </a>
            )}
            <Link
              href="/dashboard"
              className="hidden shrink-0 text-sm font-medium text-brand hover:text-brand sm:inline"
            >
              {t('viewOnTouchResume')}
            </Link>
            <button
              type="button"
              onClick={() => openModal('settings')}
              className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full border bg-white px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              aria-label={t('settings')}
              title={t('settings')}
            >
              <Avatar className="h-7 w-7">
                {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={displayName} />}
                <AvatarFallback className="bg-brand-muted text-brand text-xs">
                  {user ? displayName.slice(0, 1).toUpperCase() : <Settings className="h-3.5 w-3.5" />}
                </AvatarFallback>
              </Avatar>
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <PublicResumeReview token={token} password={password} resume={resume} shareMeta={shareMeta} />
        </div>
        <SettingsDialog />
        </div>
      </div>
    );
  }

  return null;
}
