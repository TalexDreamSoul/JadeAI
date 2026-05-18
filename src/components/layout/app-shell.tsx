'use client';

import { Header } from '@/components/layout/header';
import { SettingsDialog } from '@/components/settings/settings-dialog';
import { SettingsLauncher } from '@/components/layout/settings-launcher';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
      <SettingsLauncher />
      <SettingsDialog />
    </div>
  );
}
