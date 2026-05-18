'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { CloudOff, Languages, LogIn, LogOut, Monitor, Moon, Paintbrush, Settings, Sun, User } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/routing';
import { locales, localeNames } from '@/i18n/config';
import { BrandSwitcher } from '@/components/layout/brand-switcher';
import { LoginDialog } from '@/components/auth/login-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useState } from 'react';
import { useUIStore } from '@/stores/ui-store';
import { useAuth } from '@/hooks/use-auth';

interface SettingsLauncherProps {
  variant?: 'icon' | 'profile';
}

export function SettingsLauncher({ variant = 'icon' }: SettingsLauncherProps) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { openModal, setSettingsTab } = useUIStore();
  const { user, signOut } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const authT = useTranslations('auth');
  const displayName = user?.name || user?.email || authT('localUser');
  const callbackUrl = typeof window !== 'undefined'
    ? `${window.location.pathname}${window.location.search}`
    : '/dashboard';

  const openSettings = (tab?: 'ai' | 'appearance' | 'editor') => {
    if (tab) setSettingsTab(tab);
    openModal('settings');
  };

  const trigger = variant === 'profile' ? (
    <button
      type="button"
      className="fixed bottom-4 left-4 z-50 flex h-13 max-w-[220px] cursor-pointer items-center gap-2 rounded-full border bg-white px-2.5 pr-4 text-left text-zinc-700 shadow-lg transition-colors hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      aria-label={displayName}
      title={displayName}
    >
      <Avatar className="h-8 w-8 shrink-0">
        {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={displayName} />}
        <AvatarFallback className="bg-brand-muted text-brand">
          {user ? (displayName.slice(0, 1).toUpperCase()) : <CloudOff className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>
      <span className="hidden min-w-0 flex-col leading-tight sm:flex">
        <span className="truncate text-sm font-medium">{displayName}</span>
        <span className="truncate text-[11px] text-zinc-400">{user ? authT('settings') : authT('localOnlyHint')}</span>
      </span>
      <Settings className="h-4 w-4 shrink-0 text-zinc-400" />
    </button>
  ) : (
    <button
      type="button"
      className="fixed bottom-4 left-4 z-50 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border bg-white text-zinc-600 shadow-lg transition-colors hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
      aria-label={t('settings.title')}
      title={t('settings.title')}
    >
      <Settings className="h-5 w-5" />
    </button>
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-64">
          <div className="flex items-center gap-2 px-2 py-2">
            <Avatar className="h-9 w-9">
              {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={displayName} />}
              <AvatarFallback className="bg-brand-muted text-brand">
                {user ? (displayName.slice(0, 1).toUpperCase()) : <User className="h-4 w-4" />}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{displayName}</p>
              <p className="truncate text-xs text-zinc-500">{user?.email || authT('localOnlyHint')}</p>
            </div>
          </div>
          <DropdownMenuSeparator />
          {!user ? (
            <DropdownMenuItem onClick={() => setLoginOpen(true)} className="cursor-pointer rounded-md bg-brand text-white focus:bg-brand focus:text-white">
              <LogIn className="mr-2 h-4 w-4" />
              {authT('login')}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={signOut} className="cursor-pointer text-red-600 focus:text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              {authT('logout')}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => openSettings()} className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            {t('settings.title')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
          <DropdownMenuSubTrigger className="cursor-pointer">
            <Languages className="mr-2 h-4 w-4" />
            {t('settings.appearance.language')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={locale}
              onValueChange={(newLocale) => router.replace(pathname, { locale: newLocale })}
            >
              {locales.map((loc) => (
                <DropdownMenuRadioItem key={loc} value={loc} className="cursor-pointer">
                  {localeNames[loc]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
          <DropdownMenuSubTrigger className="cursor-pointer">
            <Paintbrush className="mr-2 h-4 w-4" />
            {t('settings.appearance.theme')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={theme || 'system'} onValueChange={setTheme}>
              <DropdownMenuRadioItem value="light" className="cursor-pointer">
                <Sun className="mr-2 h-4 w-4" />
                {t('settings.appearance.themeLight')}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark" className="cursor-pointer">
                <Moon className="mr-2 h-4 w-4" />
                {t('settings.appearance.themeDark')}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system" className="cursor-pointer">
                <Monitor className="mr-2 h-4 w-4" />
                {t('settings.appearance.themeSystem')}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="px-2 py-1 text-xs font-normal text-muted-foreground">
            {t('brand.label')}
          </DropdownMenuLabel>
          <BrandSwitcher />
        </DropdownMenuContent>
      </DropdownMenu>
      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} callbackUrl={callbackUrl} />
    </>
  );
}
