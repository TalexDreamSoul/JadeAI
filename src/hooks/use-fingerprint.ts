'use client';

import { useEffect, useState } from 'react';
import { ensureClientFingerprint, getStoredFingerprint, FINGERPRINT_STORAGE_KEY } from '@/lib/client-fingerprint';

export function useFingerprint() {
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function getFingerprint() {
      const fingerprint = await ensureClientFingerprint();
      if (!cancelled) {
        setFingerprint(fingerprint);
        setIsLoading(false);
      }
    }

    getFingerprint();

    const syncStoredFingerprint = () => {
      if (!cancelled) setFingerprint(getStoredFingerprint());
    };
    window.addEventListener('storage', syncStoredFingerprint);
    window.addEventListener(FINGERPRINT_STORAGE_KEY, syncStoredFingerprint);

    return () => {
      cancelled = true;
      window.removeEventListener('storage', syncStoredFingerprint);
      window.removeEventListener(FINGERPRINT_STORAGE_KEY, syncStoredFingerprint);
    };
  }, []);

  return { fingerprint, isLoading };
}
