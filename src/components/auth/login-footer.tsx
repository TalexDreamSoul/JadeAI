'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

export function LoginFooter() {
  const t = useTranslations('auth');
  const [footer, setFooter] = useState({ text: '', linkText: '', linkUrl: '' });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/providers-config')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setFooter({
            text: String(data.loginFooterText || ''),
            linkText: String(data.loginFooterLinkText || ''),
            linkUrl: String(data.loginFooterLinkUrl || ''),
          });
        }
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, []);

  const text = footer.text || t('agreeTerms');
  if (!text) return null;

  return (
    <p className="mt-6 text-center text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500">
      {text}
      {footer.linkText && footer.linkUrl && (
        <>
          {' '}
          <a href={footer.linkUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">
            {footer.linkText}
          </a>
        </>
      )}
    </p>
  );
}
