'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, CheckCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  createdAt: string | number | Date;
};

const BROWSER_NOTIFICATION_KEY = 'touchresume_browser_notifications_enabled';
const SEEN_NOTIFICATIONS_KEY = 'touchresume_seen_notifications';

function getHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const fp = localStorage.getItem('touchresume_fingerprint');
  return fp ? { 'x-fingerprint': fp } : {};
}

function loadSeenIds() {
  if (typeof window === 'undefined') return new Set<string>();
  try {
    const raw = localStorage.getItem(SEEN_NOTIFICATIONS_KEY);
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set<string>();
  }
}

function loadBrowserNotificationEnabled() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(BROWSER_NOTIFICATION_KEY) === 'true';
}

function saveSeenIds(ids: Set<string>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SEEN_NOTIFICATIONS_KEY, JSON.stringify(Array.from(ids).slice(0, 200)));
}

function formatDate(value: string | number | Date) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function NotificationCenter() {
  const t = useTranslations('notifications');
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(() => loadSeenIds());
  const [browserEnabled, setBrowserEnabled] = useState(() => loadBrowserNotificationEnabled());
  const [lastNotifiedId, setLastNotifiedId] = useState<string | null>(null);

  const unreadCount = useMemo(
    () => items.filter((item) => !seenIds.has(item.id)).length,
    [items, seenIds],
  );

  const markAllRead = useCallback(() => {
    const next = new Set(items.map((item) => item.id));
    setSeenIds(next);
    saveSeenIds(next);
  }, [items]);

  const requestBrowserPermission = useCallback(async (enabled: boolean) => {
    if (!enabled) {
      localStorage.setItem(BROWSER_NOTIFICATION_KEY, 'false');
      setBrowserEnabled(false);
      return;
    }
    if (!('Notification' in window)) return;
    const permission = Notification.permission === 'default'
      ? await Notification.requestPermission()
      : Notification.permission;
    const granted = permission === 'granted';
    localStorage.setItem(BROWSER_NOTIFICATION_KEY, String(granted));
    setBrowserEnabled(granted);
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { headers: getHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      const nextItems = Array.isArray(data.notifications) ? data.notifications : [];
      setItems(nextItems);

      const latest = nextItems.find((item: NotificationItem) => !seenIds.has(item.id));
      if (
        latest
        && latest.id !== lastNotifiedId
        && browserEnabled
        && typeof window !== 'undefined'
        && 'Notification' in window
        && Notification.permission === 'granted'
      ) {
        new Notification(latest.title, { body: latest.description || t('defaultBody') });
        setLastNotifiedId(latest.id);
      }
    } catch {
      // best effort
    }
  }, [browserEnabled, lastNotifiedId, seenIds, t]);

  useEffect(() => {
    const firstTick = window.setTimeout(fetchNotifications, 0);
    const timer = window.setInterval(fetchNotifications, 30_000);
    return () => {
      window.clearTimeout(firstTick);
      window.clearInterval(timer);
    };
  }, [fetchNotifications]);

  return (
    <DropdownMenu onOpenChange={(open) => open && fetchNotifications()}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-10 w-10 cursor-pointer">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-2">
          <DropdownMenuLabel className="p-0">{t('title')}</DropdownMenuLabel>
          <Button variant="ghost" size="sm" className="h-7 cursor-pointer gap-1 px-2 text-xs" onClick={markAllRead}>
            <CheckCheck className="h-3.5 w-3.5" />
            {t('markAllRead')}
          </Button>
        </div>
        <DropdownMenuSeparator />
        <div className="flex items-center justify-between px-2 py-2 text-sm">
          <span className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
            {browserEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            {t('browserNotifications')}
          </span>
          <Switch checked={browserEnabled} onCheckedChange={requestBrowserPermission} />
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-zinc-400">{t('empty')}</div>
          ) : (
            items.map((item) => {
              const unread = !seenIds.has(item.id);
              return (
                <DropdownMenuItem key={item.id} className="block cursor-default whitespace-normal px-3 py-2">
                  <div className="flex items-start gap-2">
                    <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${unread ? 'bg-brand' : 'bg-zinc-200'}`} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.title}</div>
                      {item.description && <div className="mt-0.5 text-xs leading-relaxed text-zinc-500">{item.description}</div>}
                      <div className="mt-1 text-[11px] text-zinc-400">{formatDate(item.createdAt)}</div>
                    </div>
                  </div>
                </DropdownMenuItem>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
