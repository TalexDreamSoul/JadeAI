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

function currentCallbackUrl(fallback = '/dashboard') {
  if (typeof window === 'undefined') return fallback;
  return `${window.location.pathname}${window.location.search}` || fallback;
}

export function LoginDialog({ open, onOpenChange, callbackUrl }: LoginDialogProps) {
  const t = useTranslations('auth');
  const { update } = useSession();
  const resolvedCallbackUrl = callbackUrl || currentCallbackUrl();
  const [providers, setProviders] = useState<AuthProviderConfig[]>([]);
  const [passwordRegisterEnabled, setPasswordRegisterEnabled] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [footerText, setFooterText] = useState('');
  const [footerLinkText, setFooterLinkText] = useState('');
  const [footerLinkUrl, setFooterLinkUrl] = useState('');
  const [providersLoaded, setProvidersLoaded] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setProvidersLoaded(false);

    fetch('/api/auth/providers-config')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setProviders(Array.isArray(data.providers) ? data.providers : []);
          setPasswordRegisterEnabled(data.passwordRegisterEnabled !== false);
          setFooterText(String(data.loginFooterText || ''));
          setFooterLinkText(String(data.loginFooterLinkText || ''));
          setFooterLinkUrl(String(data.loginFooterLinkUrl || ''));
          setProvidersLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setProvidersLoaded(true);
      });

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
    signIn(providerId, { callbackUrl: resolvedCallbackUrl }).finally(() => setLoadingProvider(null));
  };

  useEffect(() => {
    if (!open || !providersLoaded || loadingProvider) return;
    if (!passwordEnabled && oauthProviders.length === 1) {
      handleOAuthSignIn(oauthProviders[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, providersLoaded, passwordEnabled, oauthProviders.length, loadingProvider]);

  const renderedFooter = footerText || t('agreeTerms');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{t('loginTitle')}</DialogTitle>
          <DialogDescription>{t('loginDialogDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!providersLoaded && (
            <div className="flex items-center justify-center py-6 text-sm text-zinc-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('loading')}
            </div>
          )}

          {providersLoaded && passwordEnabled && (
            <EmailAuthForm
              allowLogin={passwordLoginEnabled}
              allowRegister={passwordRegisterEnabled}
              callbackUrl={resolvedCallbackUrl}
              onSuccess={() => {
                onOpenChange(false);
                update();
              }}
            />
          )}

          {providersLoaded && passwordEnabled && oauthProviders.length > 0 && (
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-[11px] text-zinc-400">{t('or')}</span>
              <Separator className="flex-1" />
            </div>
          )}

          {providersLoaded && oauthProviders.map((provider) => (
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

          {providersLoaded && !anyAuthEnabled && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {t('noLoginMethods')}
            </p>
          )}

          {providersLoaded && renderedFooter && (
            <p className="text-center text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500">
              {renderedFooter}
              {footerLinkText && footerLinkUrl && (
                <>
                  {' '}
                  <a href={footerLinkUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                    {footerLinkText}
                  </a>
                </>
              )}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
