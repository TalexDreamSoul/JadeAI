'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type IdlePrivacyLockOptions = {
  timeoutMs: number;
  enabled?: boolean;
  onBeforeLock?: () => void | Promise<void>;
  onLock?: () => void | Promise<void>;
};

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'pointerdown',
];

export function useIdlePrivacyLock({
  timeoutMs,
  enabled = true,
  onBeforeLock,
  onLock,
}: IdlePrivacyLockOptions) {
  const [locked, setLocked] = useState(false);
  const timerRef = useRef<number | null>(null);
  const enabledRef = useRef(enabled);
  const lockedRef = useRef(locked);
  const onBeforeLockRef = useRef(onBeforeLock);
  const onLockRef = useRef(onLock);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  useEffect(() => {
    onBeforeLockRef.current = onBeforeLock;
  }, [onBeforeLock]);

  useEffect(() => {
    onLockRef.current = onLock;
  }, [onLock]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const lockNow = useCallback(() => {
    if (!enabledRef.current || lockedRef.current) return;
    clearTimer();

    Promise.resolve(onBeforeLockRef.current?.())
      .catch((error) => {
        console.error('[privacy-lock] onBeforeLock failed:', error);
      })
      .finally(() => {
        if (!enabledRef.current || lockedRef.current) return;
        lockedRef.current = true;
        setLocked(true);
        Promise.resolve(onLockRef.current?.()).catch((error) => {
          console.error('[privacy-lock] onLock failed:', error);
        });
      });
  }, [clearTimer]);

  const resetTimer = useCallback(() => {
    clearTimer();
    if (!enabledRef.current || lockedRef.current || timeoutMs <= 0) return;
    timerRef.current = window.setTimeout(lockNow, timeoutMs);
  }, [clearTimer, lockNow, timeoutMs]);

  useEffect(() => {
    if (!enabled || locked || timeoutMs <= 0) {
      clearTimer();
      return;
    }

    const handleActivity = () => resetTimer();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') resetTimer();
    };

    resetTimer();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, handleActivity, { passive: true }));
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimer();
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, handleActivity));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [clearTimer, enabled, locked, resetTimer, timeoutMs]);

  useEffect(() => clearTimer, [clearTimer]);

  const reloadToUnlock = useCallback(() => {
    window.location.reload();
  }, []);

  return { locked, lockNow, reloadToUnlock, resetTimer };
}
