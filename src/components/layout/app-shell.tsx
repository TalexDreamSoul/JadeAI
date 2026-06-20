'use client';

import { Header } from '@/components/layout/header';
import { SettingsDialog } from '@/components/settings/settings-dialog';
import { SettingsLauncher } from '@/components/layout/settings-launcher';
import { usePathname } from '@/i18n/routing';
import { cn } from '@/lib/utils';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminPage = pathname.startsWith('/admin');

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-background">
      <Header />
      <main
        className={cn(
          'mx-auto px-4 py-8 sm:px-6',
          isAdminPage ? 'max-w-[1680px]' : 'max-w-7xl'
        )}
      >
        {children}
      </main>
      <SettingsLauncher />
      <SettingsDialog />
    </div>
  );
}
