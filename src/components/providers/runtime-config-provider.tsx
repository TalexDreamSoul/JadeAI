'use client';

import { createContext, useContext, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { getClientCloudUser, setClientCloudUser } from '@/hooks/use-auth';

interface RuntimeConfig {
  authEnabled: boolean;
  localOnly: boolean;
}

const RuntimeConfigContext = createContext<RuntimeConfig>({ authEnabled: false, localOnly: false });

export function RuntimeConfigProvider({
  children,
  authEnabled,
}: {
  children: React.ReactNode;
  authEnabled: boolean;
}) {
  const { status, data: session } = useSession();
  const sessionUser = session?.user?.email ? {
    id: session.user.id || '',
    name: session.user.name,
    email: session.user.email,
    avatarUrl: session.user.image,
  } : null;
  if (sessionUser) setClientCloudUser(sessionUser);
  const cachedUser = status === 'unauthenticated' ? null : getClientCloudUser();
  const isCloudUser = authEnabled && (!!sessionUser || !!cachedUser?.email);
  const localOnly = authEnabled ? !isCloudUser : false;

  useEffect(() => {
    if (authEnabled) {
      document.documentElement.dataset.authEnabled = 'true';
    } else {
      delete document.documentElement.dataset.authEnabled;
    }

    if (localOnly) {
      document.documentElement.dataset.localOnly = 'true';
    } else {
      delete document.documentElement.dataset.localOnly;
    }
  }, [authEnabled, localOnly]);

  return (
    <RuntimeConfigContext.Provider value={{ authEnabled, localOnly }}>
      {children}
    </RuntimeConfigContext.Provider>
  );
}

export function useRuntimeConfig() {
  return useContext(RuntimeConfigContext);
}
