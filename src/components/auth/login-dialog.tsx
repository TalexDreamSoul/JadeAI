'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { signIn } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { EmailAuthForm } from './email-auth-form';

interface AuthProviderConfig {
  id: string;
  enabled: boolean;
  loginEnabled?: boolean;
  registerEnabled?: boolean;
  name?: string;
}

interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callbackUrl?: string;
}

/** Simple SVG icons for known OAuth providers. */
function providerIcon(providerId: string): ReactNode {
  switch (providerId) {
    case 'google':
      return (
        <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
      );
    case 'github':
      return (
        <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
        </svg>
      );
    case 'microsoft-entra-id':
      return (
        <svg className="h-[18px] w-[18px]" viewBox="0 0 21 21" fill="none">
          <rect x="1" y="1" width="9" height="9" fill="#F25022" />
          <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
          <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
          <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
        </svg>
      );
    default:
      return null;
  }
}

export function LoginDialog({ open, onOpenChange, callbackUrl = '/dashboard' }: LoginDialogProps) {
  const t = useTranslations('auth');
  const { update } = useSession();
  const [providers, setProviders] = useState<AuthProviderConfig[]>([
    { id: 'password', enabled: true },
  ]);
  const [passwordRegisterEnabled, setPasswordRegisterEnabled] = useState(true);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    fetch('/api/auth/providers-config')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data.providers)) {
          setProviders(data.providers);
          setPasswordRegisterEnabled(data.passwordRegisterEnabled !== false);
        }
      })
      .catch(() => null);

    return () => {
      cancelled = true;
    };
  }, [open]);

  const passwordProvider = providers.find((provider) => provider.id === 'password');
  const passwordEnabled = !!passwordProvider?.enabled;
  const passwordLoginEnabled = passwordProvider?.loginEnabled !== false;

  // All OAuth providers (everything except 'password')
  const oauthProviders = providers.filter((provider) => provider.id !== 'password' && provider.enabled);

  const anyAuthEnabled = passwordEnabled || oauthProviders.length > 0;

  const handleOAuthSignIn = (providerId: string) => {
    setLoadingProvider(providerId);
    signIn(providerId, { callbackUrl }).finally(() => setLoadingProvider(null));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{t('loginTitle')}</DialogTitle>
          <DialogDescription>{t('loginDialogDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {passwordEnabled && (
            <EmailAuthForm
              allowLogin={passwordLoginEnabled}
              allowRegister={passwordRegisterEnabled}
              callbackUrl={callbackUrl}
              onSuccess={() => {
                onOpenChange(false);
                update();
              }}
            />
          )}

          {passwordEnabled && oauthProviders.length > 0 && (
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-[11px] text-zinc-400">{t('or')}</span>
              <Separator className="flex-1" />
            </div>
          )}

          {oauthProviders.map((provider) => (
            <Button
              key={provider.id}
              type="button"
              variant="outline"
              disabled={loadingProvider === provider.id}
              onClick={() => handleOAuthSignIn(provider.id)}
              className="h-11 w-full cursor-pointer gap-3 rounded-xl"
            >
              {loadingProvider === provider.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                providerIcon(provider.id)
              )}
              {t('loginWithProvider', { provider: provider.name || provider.id })}
            </Button>
          ))}

          {!anyAuthEnabled && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {t('noLoginMethods')}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
