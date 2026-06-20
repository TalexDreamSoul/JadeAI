'use client';

import Image from 'next/image';
import { ChevronDown, Menu } from 'lucide-react';
import { NotificationCenter } from '@/components/notifications/notification-center';
import { UserMenu } from './user-menu';
import { Link, usePathname } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';

type NavItem = { href: string; i18nKey: string; match: string; tourId?: string };

const DASHBOARD_NAV_ITEM: NavItem = { href: '/dashboard', i18nKey: 'dashboard.nav', match: '/dashboard' };
const CAREER_NAV_ITEMS: NavItem[] = [
  { href: '/career', i18nKey: 'career.nav', match: '/career' },
  { href: '/knowledge', i18nKey: 'knowledge.nav', match: '/knowledge' },
  { href: '/interview', i18nKey: 'interview.nav', match: '/interview' },
];
const PRIMARY_NAV_ITEMS: NavItem[] = [
  { href: '/templates', i18nKey: 'templates.nav', match: '/templates', tourId: 'dash-templates' },
];
const ADMIN_NAV_ITEM: NavItem = { href: '/admin', i18nKey: 'admin.nav', match: '/admin' };
export function Header() {
  const t = useTranslations();
  const pathname = usePathname();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const careerActive = CAREER_NAV_ITEMS.some((item) => pathname.startsWith(item.match));
  const visiblePrimaryNavItems = isAdmin ? [...PRIMARY_NAV_ITEMS, ADMIN_NAV_ITEM] : PRIMARY_NAV_ITEMS;

  const renderDesktopLink = (item: NavItem) => {
    const isActive = pathname.startsWith(item.match);
    return (
      <Link
        key={item.href}
        href={item.href}
        data-tour={item.tourId}
        className={cn(
          'relative rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          isActive
            ? 'text-zinc-900 dark:text-zinc-100'
            : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
        )}
      >
        {t(item.i18nKey)}
        {isActive && (
          <span className="absolute bottom-[-9px] left-1/2 h-[2px] w-4/5 -translate-x-1/2 rounded-full bg-brand" />
        )}
      </Link>
    );
  };

  const renderMobileLink = (item: NavItem) => {
    const isActive = pathname.startsWith(item.match);
    return (
      <Link
        key={item.href}
        href={item.href}
        data-tour={item.tourId}
        className={cn(
          'rounded-md px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
            : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
        )}
      >
        {t(item.i18nKey)}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:bg-background/95 dark:supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-1">
            <Image src="/logo.png" alt="TouchResume" width={36} height={36} priority className="h-9 w-9 rounded-lg" />
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {renderDesktopLink(DASHBOARD_NAV_ITEM)}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'relative inline-flex cursor-pointer items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    careerActive
                      ? 'text-zinc-900 dark:text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                  )}
                >
                  {t('career.nav')}
                  <ChevronDown className="h-3.5 w-3.5" />
                  {careerActive && (
                    <span className="absolute bottom-[-9px] left-1/2 h-[2px] w-4/5 -translate-x-1/2 rounded-full bg-brand" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {CAREER_NAV_ITEMS.map((item) => (
                  <DropdownMenuItem key={item.href} asChild className="cursor-pointer">
                    <Link href={item.href}>{t(item.i18nKey)}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {visiblePrimaryNavItems.map(renderDesktopLink)}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <NotificationCenter />
          <UserMenu />
          {/* Mobile menu */}
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64">
                <nav className="flex flex-col gap-2 pt-8">
                  {renderMobileLink(DASHBOARD_NAV_ITEM)}
                  <div className="rounded-lg border border-zinc-200 p-2 dark:border-zinc-800">
                    <div className={cn(
                      'px-1 pb-1 text-xs font-semibold uppercase tracking-wider',
                      careerActive ? 'text-brand' : 'text-zinc-400'
                    )}
                    >
                      {t('career.nav')}
                    </div>
                    <div className="flex flex-col gap-1">
                      {CAREER_NAV_ITEMS.map((item) => {
                        const isActive = pathname.startsWith(item.match);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                              'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                              isActive
                                ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                                : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
                            )}
                          >
                            {t(item.i18nKey)}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                  {visiblePrimaryNavItems.map(renderMobileLink)}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
