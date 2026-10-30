export type DesktopMode = 'local' | 'remote';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);

export function resolveDesktopMode(value: string | undefined, packaged: boolean): DesktopMode {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return packaged ? 'remote' : 'local';
  if (normalized === 'local' || normalized === 'remote') return normalized;
  throw new Error(`Unsupported JADE_DESKTOP_MODE: ${value}`);
}

export function normalizeRemoteUrl(value: string | undefined, packaged: boolean): URL {
  if (!value?.trim()) throw new Error('JADE_DESKTOP_URL is required for remote desktop mode');

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('JADE_DESKTOP_URL must be a valid absolute URL');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('JADE_DESKTOP_URL must use HTTP or HTTPS');
  }
  if (url.username || url.password) {
    throw new Error('JADE_DESKTOP_URL must not contain credentials');
  }
  if (packaged && url.protocol !== 'https:' && !LOOPBACK_HOSTS.has(url.hostname)) {
    throw new Error('Packaged remote desktop mode requires HTTPS');
  }

  url.hash = '';
  url.search = '';
  return url;
}

export function buildDesktopStartUrl(baseUrl: URL, startPath: string | undefined): string {
  const path = startPath?.trim() || '/zh';
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new Error('Desktop start path must be an origin-relative path');
  }
  return new URL(path, baseUrl).toString();
}

export function isTrustedInAppNavigation(value: string, trustedOrigin: string | null): boolean {
  if (!trustedOrigin) return false;
  try {
    return new URL(value).origin === trustedOrigin;
  } catch {
    return false;
  }
}

export function isSafeExternalNavigation(value: string): boolean {
  try {
    return ['http:', 'https:', 'mailto:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function isSafeCheckoutNavigation(value: string, packaged: boolean): boolean {
  try {
    const url = new URL(value);
    if (url.username || url.password) return false;
    if (url.protocol === 'https:') return true;
    return !packaged && url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}
