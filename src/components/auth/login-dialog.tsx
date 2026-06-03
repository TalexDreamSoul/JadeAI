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
  if (providerId !== 'oidc') return null;

  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3 4 7v5c0 5 3.4 7.9 8 9 4.6-1.1 8-4 8-9V7l-8-4Z" className="fill-brand/20 stroke-brand" strokeWidth="1.6" />
      <path d="M9.25 12.25 11 14l4-4" className="stroke-brand" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
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
