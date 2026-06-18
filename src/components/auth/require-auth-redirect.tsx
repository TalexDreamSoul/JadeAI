'use client';

import { useEffect } from 'react';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';
import { useAuth } from '@/hooks/use-auth';

const PUBLIC_PATHS = ['/', '/login'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function RequireAuthRedirect() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isLoading || isAuthenticated || isPublicPath(pathname)) return;

    const currentPath = `/${locale}${pathname === '/' ? '' : pathname}`;
    const callbackUrl = `${currentPath}${window.location.search}`;
    router.replace({ pathname: '/login', query: { callbackUrl } });
  }, [isLoading, isAuthenticated, locale, pathname, router]);

  return null;
}
