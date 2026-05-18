import { NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

// Public paths that don't require authentication (relative to locale prefix)
const PUBLIC_PATHS = [
  '/',        // Landing page
  '/login',   // Login page
  '/share',   // Public share links
];

function isPublicPath(pathname: string): boolean {
  // Strip locale prefix: /zh/dashboard -> /dashboard, /en/ -> /
  const withoutLocale = pathname.replace(/^\/(zh|en)/, '') || '/';
  return PUBLIC_PATHS.some((p) =>
    p === '/' ? withoutLocale === '/' : withoutLocale.startsWith(p)
  );
}

export default async function middleware(request: NextRequest) {
  // Always run i18n middleware first
  const response = intlMiddleware(request);

  // Only check auth when OAuth is enabled
  const authEnabled = process.env.AUTH_ENABLED === 'true';
  if (!authEnabled) return response;

  // Skip auth check for public paths and API routes
  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/api/')) return response;
  if (isPublicPath(pathname)) return response;

  // Logged-out users stay in Local Only mode; cloud APIs are disabled client-side.
  // Keep pages accessible so users can edit local resumes and open the login dialog when needed.
  return response;
}

export const config = {
  matcher: ['/', '/(zh|en)/:path*', '/share/:path*'],
};
