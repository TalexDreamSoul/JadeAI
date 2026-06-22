'use client';

import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { generateId } from '@/lib/utils';

export const FINGERPRINT_STORAGE_KEY = 'touchresume_fingerprint';

let pendingFingerprint: Promise<string | null> | null = null;

export function getStoredFingerprint(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(FINGERPRINT_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

function storeFingerprint(fingerprint: string) {
  try {
    localStorage.setItem(FINGERPRINT_STORAGE_KEY, fingerprint);
    window.dispatchEvent(new Event(FINGERPRINT_STORAGE_KEY));
  } catch { /* ignore */ }
}

async function createFingerprint(): Promise<string | null> {
  const stored = getStoredFingerprint();
  if (stored) return stored;

  try {
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    if (result.visitorId) {
      storeFingerprint(result.visitorId);
      return result.visitorId;
    }
  } catch { /* fall back below */ }

  const fallbackId = generateId();
  storeFingerprint(fallbackId);
  return fallbackId;
}

export function ensureClientFingerprint(): Promise<string | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);

  const stored = getStoredFingerprint();
  if (stored) return Promise.resolve(stored);

  if (!pendingFingerprint) {
    pendingFingerprint = createFingerprint().finally(() => {
      pendingFingerprint = null;
    });
  }

  return pendingFingerprint;
}
