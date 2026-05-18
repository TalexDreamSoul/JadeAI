'use client';

import { useEffect, useState } from 'react';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { generateId } from '@/lib/utils';

export function useFingerprint() {
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function getFingerprint() {
      try {
        // Check localStorage first
        const stored = localStorage.getItem('touchresume_fingerprint');
        if (stored) {
          localStorage.setItem('touchresume_fingerprint', stored);
          setFingerprint(stored);
          setIsLoading(false);
          return;
        }

        const fp = await FingerprintJS.load();
        const result = await fp.get();
        const visitorId = result.visitorId;

        localStorage.setItem('touchresume_fingerprint', visitorId);
        setFingerprint(visitorId);
      } catch {
        // Fallback: generate a random ID
        const fallbackId = generateId();
        localStorage.setItem('touchresume_fingerprint', fallbackId);
        setFingerprint(fallbackId);
      } finally {
        setIsLoading(false);
      }
    }

    getFingerprint();
  }, []);

  return { fingerprint, isLoading };
}
