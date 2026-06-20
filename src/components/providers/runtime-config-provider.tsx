'use client';

import { createContext, useContext, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';

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
  const { isAuthenticated } = useAuth();
  const isCloudUser = authEnabled && isAuthenticated;
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
