'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface EmailAuthFormProps {
  allowLogin?: boolean;
  allowRegister?: boolean;
  callbackUrl?: string;
  onSuccess?: () => void;
  redirectOnSuccess?: boolean;
}

export function EmailAuthForm({
  allowLogin = true,
  allowRegister = true,
  callbackUrl: callbackUrlProp,
  onSuccess,
  redirectOnSuccess = true,
}: EmailAuthFormProps = {}) {
  const t = useTranslations('auth');
  const searchParams = useSearchParams();
  const callbackUrl = callbackUrlProp || searchParams.get('callbackUrl') || '/dashboard';
  const [mode, setMode] = useState<'login' | 'register'>(allowLogin ? 'login' : 'register');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (mode === 'login' && !allowLogin) {
        throw new Error(t('loginDisabled'));
      }
      if (mode === 'register' && !allowRegister) {
        throw new Error(t('registerDisabled'));
      }

      if (mode === 'register') {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, name, password }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || t('registerFailed'));
        }
      }

      const result = await signIn('password', {
        email,
        password,
        redirect: false,
        callbackUrl,
      });
      if (result?.error) throw new Error(t('loginFailed'));
      await fetch('/api/auth/session').catch(() => null);
      onSuccess?.();
      if (redirectOnSuccess) {
        window.location.href = result?.url || callbackUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="w-full space-y-3">
      {mode === 'register' && (
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('namePlaceholder')}
          autoComplete="name"
        />
      )}
      <Input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t('emailPlaceholder')}
        type="email"
        autoComplete="email"
        required
      />
      <Input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={t('passwordPlaceholder')}
        type="password"
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        minLength={8}
        required
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <Button type="submit" disabled={loading} className="w-full cursor-pointer bg-brand hover:bg-brand-hover">
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {mode === 'login' ? t('loginWithEmail') : t('registerWithEmail')}
      </Button>
      {(allowRegister && allowLogin) && (
        <button
          type="button"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError('');
          }}
          className="w-full cursor-pointer text-xs text-brand hover:underline"
        >
          {mode === 'login' ? t('switchToRegister') : t('switchToLogin')}
        </button>
      )}
    </form>
  );
}
