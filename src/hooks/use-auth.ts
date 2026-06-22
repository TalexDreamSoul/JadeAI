'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';

const CLOUD_USER_STORAGE_KEY = 'touchresume_cloud_user';
const CLOUD_USER_CHANGE_EVENT = 'touchresume_cloud_user_change';

type ClientCloudUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  role?: 'user' | 'admin';
};

function normalizeRole(role: unknown): 'user' | 'admin' {
  return role === 'admin' ? 'admin' : 'user';
}

function parseClientCloudUser(raw: string | null) {
  if (!raw) return null;
  try {
    const user = JSON.parse(raw) as ClientCloudUser;
    return user.email ? user : null;
  } catch {
    return null;
  }
}

function getClientCloudUserSnapshot() {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(CLOUD_USER_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getClientCloudUser() {
  if (typeof window === 'undefined') return null;
  return parseClientCloudUser(getClientCloudUserSnapshot());
}

export function setClientCloudUser(user: ClientCloudUser) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CLOUD_USER_STORAGE_KEY, JSON.stringify(user));
    window.dispatchEvent(new Event(CLOUD_USER_CHANGE_EVENT));
  } catch { /* ignore */ }
}

export function clearClientCloudUser() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(CLOUD_USER_STORAGE_KEY);
    window.dispatchEvent(new Event(CLOUD_USER_CHANGE_EVENT));
  } catch { /* ignore */ }
}

function subscribeClientCloudUser(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener('storage', onStoreChange);
  window.addEventListener(CLOUD_USER_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener(CLOUD_USER_CHANGE_EVENT, onStoreChange);
  };
}

export function useAuth() {
  const session = useSession();
  const cachedUserRaw = useSyncExternalStore(subscribeClientCloudUser, getClientCloudUserSnapshot, () => null);
  const cachedUser = useMemo(() => parseClientCloudUser(cachedUserRaw), [cachedUserRaw]);
  const sessionUser = useMemo(() => (
    session.data?.user?.email
      ? {
          id: session.data.user.id || '',
          name: session.data.user.name,
          email: session.data.user.email,
          avatarUrl: session.data.user.image,
          authType: 'oauth' as const,
          role: normalizeRole(session.data.user.role),
        }
      : null
  ), [session.data]);

  useEffect(() => {
    if (session.status === 'unauthenticated') {
      clearClientCloudUser();
    }
  }, [session.status]);

  useEffect(() => {
    if (!sessionUser) return;
    setClientCloudUser(sessionUser);
  }, [sessionUser]);

  const user = sessionUser || (session.status !== 'unauthenticated' && cachedUser?.email
    ? {
        id: cachedUser.id || '',
        name: cachedUser.name,
        email: cachedUser.email,
        avatarUrl: cachedUser.avatarUrl,
        authType: 'oauth' as const,
        role: normalizeRole(cachedUser.role),
      }
    : null);

  return {
    user,
    isLoading: session.status === 'loading' && !user,
    isAuthenticated: !!user,
    signIn: () => signIn(),
    signOut: () => {
      clearClientCloudUser();
      return signOut();
    },
  };
}
