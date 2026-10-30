'use client';

import { useEffect, useState } from 'react';
import { DefaultTermsNotice } from './default-terms-notice';

export function LoginFooter() {
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

  const hasCustomFooter = Boolean(footer.text || (footer.linkText && footer.linkUrl));
  if (!hasCustomFooter) return <DefaultTermsNotice className="mt-6" />;

  return (
    <p className="mt-6 text-center text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500">
      {footer.text}
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
