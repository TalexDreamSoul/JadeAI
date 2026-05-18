'use client';

import { useSession, signIn, signOut } from 'next-auth/react';

export function getClientCloudUser() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('touchresume_cloud_user');
    if (!raw) return null;
    const user = JSON.parse(raw) as { id?: string; name?: string | null; email?: string | null; avatarUrl?: string | null };
    return user.email ? user : null;
  } catch {
    return null;
  }
}

export function setClientCloudUser(user: { id?: string; name?: string | null; email?: string | null; avatarUrl?: string | null }) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('touchresume_cloud_user', JSON.stringify(user));
  } catch { /* ignore */ }
}

export function clearClientCloudUser() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('touchresume_cloud_user');
  } catch { /* ignore */ }
}

export function useAuth() {
  const session = useSession();
  const sessionUser = session.data?.user?.email
    ? {
        id: session.data.user.id || '',
        name: session.data.user.name,
        email: session.data.user.email,
        avatarUrl: session.data.user.image,
        authType: 'oauth' as const,
      }
    : null;
  if (sessionUser) setClientCloudUser(sessionUser);
  const cachedUser = session.status === 'unauthenticated' ? null : getClientCloudUser();
  const user = sessionUser || (cachedUser?.email
    ? {
        id: cachedUser.id || '',
        name: cachedUser.name,
        email: cachedUser.email,
        avatarUrl: cachedUser.avatarUrl,
        authType: 'oauth' as const,
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
