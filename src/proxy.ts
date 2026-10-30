import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);
const LOCALE_PATTERN = /^\/(zh|en)(?=\/|$)/;

const PUBLIC_PAGE_PATHS = ['/', '/login', '/share'];
const PUBLIC_API_PATHS = [
  '/api/auth',
  '/api/events',
  '/api/health',
  '/api/internal/resume-analysis/tick',
  '/api/payments/webhook',
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
  const { pathname } = request.nextUrl;
  const authEnabled = process.env.AUTH_ENABLED === 'true';

  // API routes are not locale-aware. Running next-intl first rewrites the
  // Electron readiness probe from /api/health to /zh/api/health, which has no
  // route and prevents the local desktop server from ever becoming ready.
  if (pathname.startsWith('/api/')) {
    if (!authEnabled || isPublicApi(pathname) || hasSessionCookie(request)) {
      return NextResponse.next();
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const response = intlMiddleware(request);
  if (!authEnabled) return response;
  if (isPublicPage(pathname)) return response;
  if (!hasSessionCookie(request)) return redirectToLogin(request);
  return response;
}

export const config = {
  matcher: ['/', '/(zh|en)/:path*', '/api/:path*'],
};
