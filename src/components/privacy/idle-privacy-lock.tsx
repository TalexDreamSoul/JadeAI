'use client';

import { Lock, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface IdlePrivacyLockProps {
  onReload: () => void;
  title?: string;
  description?: string;
  reloadLabel?: string;
  hint?: string;
}

export function IdlePrivacyLock({
  onReload,
  title = '页面已锁定',
  description = '由于长时间无操作，为保护简历隐私，当前页面内容已隐藏。请重新加载页面以重新获取数据。',
  reloadLabel = '重新加载',
  hint,
}: IdlePrivacyLockProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 text-center dark:bg-zinc-950">
      <div className="w-full max-w-sm space-y-5 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-muted dark:bg-brand-muted">
          <Lock className="h-7 w-7 text-brand" />
        </div>
        <div className="space-y-2">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h1>
          <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</p>
          {hint ? <p className="text-xs leading-relaxed text-zinc-400 dark:text-zinc-500">{hint}</p> : null}
        </div>
        <Button onClick={onReload} className="w-full cursor-pointer bg-brand hover:bg-brand-hover">
          <RotateCw className="mr-2 h-4 w-4" />
          {reloadLabel}
        </Button>
      </div>
    </div>
  );
}
