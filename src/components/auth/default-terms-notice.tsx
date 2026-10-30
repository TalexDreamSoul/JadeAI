'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';

type DefaultTermsNoticeProps = {
  className?: string;
};

export function DefaultTermsNotice({ className }: DefaultTermsNoticeProps) {
  const t = useTranslations('auth');

  return (
    <p className={cn('text-center text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500', className)}>
      {t.rich('agreeTerms', {
        terms: (children) => (
          <Link href="/terms" className="text-brand hover:underline">
            {children}
          </Link>
        ),
        privacy: (children) => (
          <Link href="/privacy" className="text-brand hover:underline">
            {children}
          </Link>
        ),
      })}
    </p>
  );
}
