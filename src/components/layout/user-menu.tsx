'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useTranslations } from 'next-intl';
import { CloudOff, LogIn, LogOut, Settings, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BrandSwitcher } from '@/components/layout/brand-switcher';
import { LoginDialog } from '@/components/auth/login-dialog';
import { useUIStore } from '@/stores/ui-store';

export function UserMenu() {
  const { user, signOut } = useAuth();
  const t = useTranslations('auth');
  const { openModal } = useUIStore();
  const [loginOpen, setLoginOpen] = useState(false);
  const callbackUrl = typeof window !== 'undefined'
    ? `${window.location.pathname}${window.location.search}`
    : '/dashboard';

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="cursor-pointer rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-zinc-400">
          <Avatar className="h-8 w-8">
            {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name || ''} />}
            <AvatarFallback className="bg-zinc-200 text-xs text-zinc-600">
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <div className="px-2 py-2 text-sm">
            {user ? (
              <>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {user.name || user.email}
                </p>
                <p className="truncate text-xs text-zinc-500">{user.email}</p>
              </>
            ) : (
              <div className="flex items-start gap-2">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-muted text-brand">
                  <CloudOff className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">{t('localUser')}</p>
                  <p className="text-xs leading-relaxed text-zinc-500">{t('localOnlyHint')}</p>
                </div>
              </div>
            )}
          </div>
          <DropdownMenuSeparator />
          {!user && (
            <>
              <DropdownMenuItem onClick={() => setLoginOpen(true)} className="cursor-pointer rounded-md bg-brand text-white focus:bg-brand focus:text-white">
                <LogIn className="mr-2 h-4 w-4" />
                {t('login')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <BrandSwitcher />
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => openModal('settings')} className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            {t('settings')}
          </DropdownMenuItem>
          {user && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="cursor-pointer text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                {t('logout')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} callbackUrl={callbackUrl} />
    </>
  );
}
