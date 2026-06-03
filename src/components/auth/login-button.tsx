'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { LoginDialog } from './login-dialog';

export function LoginButton() {
  const t = useTranslations('auth');
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || (typeof window !== 'undefined'
    ? `${window.location.pathname}${window.location.search}`
    : '/dashboard');
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="outline"
        className="h-11 w-full cursor-pointer gap-3 rounded-xl border-zinc-200 bg-white px-6 text-sm font-medium text-zinc-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-zinc-50 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
      >
        {t('login')}
      </Button>
      <LoginDialog open={open} onOpenChange={setOpen} callbackUrl={callbackUrl} />
    </>
  );
}
