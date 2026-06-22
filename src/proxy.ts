import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);
const LOCALE_PATTERN = /^\/(zh|en)(?=\/|$)/;

const PUBLIC_PAGE_PATHS = ['/', '/login', '/share'];
const PUBLIC_API_PATHS = [
  '/api/auth',
  '/api/health',
  '/api/internal/resume-analysis/tick',
  '/api/ready',
  '/api/share',
];

function stripLocale(pathname: string): string {
  return pathname.replace(LOCALE_PATTERN, '') || '/';
}

function resolveLocale(pathname: string): string {
  return pathname.match(LOCALE_PATTERN)?.[1] || routing.defaultLocale;
}

function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies.has('authjs.session-token') || request.cookies.has('__Secure-authjs.session-token');
}

function isPublicPage(pathname: string): boolean {
  const withoutLocale = stripLocale(pathname);
  return PUBLIC_PAGE_PATHS.some((path) => (
    path === '/' ? withoutLocale === '/' : withoutLocale === path || withoutLocale.startsWith(`${path}/`)
  ));
}

function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function redirectToLogin(request: NextRequest) {
  const locale = resolveLocale(request.nextUrl.pathname);
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = `/${locale}/login`;
  loginUrl.search = '';
  loginUrl.searchParams.set('callbackUrl', `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export async function proxy(request: NextRequest) {
  const response = intlMiddleware(request);
  const authEnabled = process.env.AUTH_ENABLED === 'true';
  if (!authEnabled) return response;

  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/')) {
    if (isPublicApi(pathname) || hasSessionCookie(request)) {
      return NextResponse.next();
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isPublicPage(pathname)) {
    return response;
  }

  if (!hasSessionCookie(request)) {
    return redirectToLogin(request);
  }

  return response;
}

export const config = {
  matcher: ['/', '/(zh|en)/:path*', '/api/:path*'],
};
