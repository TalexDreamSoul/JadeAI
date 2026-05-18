'use client';

import { useEffect, useState } from 'react';
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
  id: 'password' | 'google';
  enabled: boolean;
  loginEnabled?: boolean;
  registerEnabled?: boolean;
}

interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callbackUrl?: string;
}

export function LoginDialog({ open, onOpenChange, callbackUrl = '/dashboard' }: LoginDialogProps) {
  const t = useTranslations('auth');
  const { update } = useSession();
  const [providers, setProviders] = useState<AuthProviderConfig[]>([
    { id: 'password', enabled: true },
    { id: 'google', enabled: false },
  ]);
  const [passwordRegisterEnabled, setPasswordRegisterEnabled] = useState(true);
  const [googleLoading, setGoogleLoading] = useState(false);

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
  const googleEnabled = providers.some((provider) => provider.id === 'google' && provider.enabled);

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

          {passwordEnabled && googleEnabled && (
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-[11px] text-zinc-400">{t('or')}</span>
              <Separator className="flex-1" />
            </div>
          )}

          {googleEnabled && (
            <Button
              type="button"
              variant="outline"
              disabled={googleLoading}
              onClick={() => {
                setGoogleLoading(true);
                signIn('google', { callbackUrl }).finally(() => setGoogleLoading(false));
              }}
              className="h-11 w-full cursor-pointer gap-3 rounded-xl"
            >
              {googleLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              {t('loginWithGoogle')}
            </Button>
          )}

          {!passwordEnabled && !googleEnabled && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {t('noLoginMethods')}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
