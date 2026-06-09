'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { useTheme } from 'next-themes';
import { Settings, Cpu, Paintbrush, PenTool, Sun, Moon, Monitor, PlugZap } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useUIStore } from '@/stores/ui-store';
import { useSettingsStore, useIsLocalOnly } from '@/stores/settings-store';
import { useTourStore } from '@/stores/tour-store';
import { usePathname, useRouter } from '@/i18n/routing';
import { locales, localeNames } from '@/i18n/config';
import { McpSettingsPanel } from './mcp-settings-panel';

export function SettingsDialog() {
  const t = useTranslations('settings');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { theme: currentTheme, setTheme } = useTheme();
  const { activeModal, closeModal, settingsTab, setSettingsTab } = useUIStore();
  const {
    serverAIConfigured,
    serverAIAvailable,
    serverAIProvider,
    serverAIModel,
    serverOpenAIEndpoint,
    aiCredits,
    autoSave,
    autoSaveInterval,
    setAutoSave,
    setAutoSaveInterval,
    hydrate,
    _hydrated,
    _localOnlyHydrated,
  } = useSettingsStore();

  const startTour = useTourStore((s) => s.startTour);
  const isOpen = activeModal === 'settings';
  const localOnly = useIsLocalOnly();

  useEffect(() => {
    if (isOpen && (!_hydrated || (!localOnly && _localOnlyHydrated))) {
      hydrate(localOnly);
    }
  }, [isOpen, _hydrated, _localOnlyHydrated, hydrate, localOnly]);

  const handleLocaleChange = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale });
  };

  const handleThemeChange = (theme: string) => {
    setTheme(theme);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[680px] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-zinc-500" />
            {t('title')}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={settingsTab} onValueChange={setSettingsTab} className="mt-4">
          <div className="px-6">
            <TabsList className="w-full">
              <TabsTrigger value="ai" className="flex-1 gap-1.5 cursor-pointer">
                <Cpu className="h-3.5 w-3.5" />
                {t('ai.title')}
              </TabsTrigger>
              <TabsTrigger value="appearance" className="flex-1 gap-1.5 cursor-pointer">
                <Paintbrush className="h-3.5 w-3.5" />
                {t('appearance.title')}
              </TabsTrigger>
              <TabsTrigger value="editor" className="flex-1 gap-1.5 cursor-pointer">
                <PenTool className="h-3.5 w-3.5" />
                {t('editorTab.title')}
              </TabsTrigger>
              <TabsTrigger value="mcp" className="flex-1 gap-1.5 cursor-pointer">
                <PlugZap className="h-3.5 w-3.5" />
                {t('mcp.title')}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* AI Configuration Tab */}
          <TabsContent value="ai" className="px-6 pb-6 pt-4 space-y-5">
            <div className="space-y-2">
              <Label>{t('ai.mode')}</Label>
              <div className="rounded-lg border border-brand/20 bg-brand-muted p-3 text-sm text-brand">
                <div className="font-medium">{t('ai.modeServer')}</div>
                <div className="mt-1 text-xs opacity-80">
                  {localOnly
                    ? t('ai.loginRequiredForServer')
                    : serverAIConfigured
                    ? t('ai.serverConfigured', {
                        provider: serverAIProvider,
                        model: serverAIModel,
                        endpoint: serverAIProvider === 'openai' ? ` / ${serverOpenAIEndpoint}` : '',
                      })
                    : t('ai.serverNotConfigured')}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200 p-3 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
              {!localOnly && serverAIConfigured && (
                <p className="mb-1 text-xs text-zinc-500">{t('ai.creditsLeft', { count: aiCredits })}</p>
              )}
              {localOnly
                ? t('ai.loginRequiredForServer')
                : serverAIConfigured
                ? t(serverAIAvailable ? 'ai.serverModeDescription' : 'ai.serverUnavailableDescription', {
                    provider: serverAIProvider,
                    model: serverAIModel,
                    endpoint: serverAIProvider === 'openai' ? ` / ${serverOpenAIEndpoint}` : '',
                  })
                : t('ai.serverNotConfigured')}
            </div>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="px-6 pb-6 pt-4 space-y-5">
            {/* Theme */}
            <div className="space-y-3">
              <Label>{t('appearance.theme')}</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'light', icon: Sun, label: t('appearance.themeLight') },
                  { value: 'dark', icon: Moon, label: t('appearance.themeDark') },
                  { value: 'system', icon: Monitor, label: t('appearance.themeSystem') },
                ].map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleThemeChange(value)}
                    className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-3 text-sm transition-all ${
                      currentTheme === value
                        ? 'border-zinc-900 bg-zinc-50 text-zinc-900 dark:border-zinc-100 dark:bg-zinc-800 dark:text-zinc-100'
                        : 'border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:border-zinc-700 dark:hover:border-zinc-600'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Language */}
            <div className="space-y-2">
              <Label>{t('appearance.language')}</Label>
              <Select value={locale} onValueChange={handleLocaleChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {locales.map((loc) => (
                    <SelectItem key={loc} value={loc}>
                      {localeNames[loc]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          {/* Editor Tab */}
          <TabsContent value="editor" className="px-6 pb-6 pt-4 space-y-5">
            {/* Auto Save */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('editorTab.autoSave')}</Label>
                <p className="text-xs text-zinc-400">{t('editorTab.autoSaveDescription')}</p>
              </div>
              <Switch
                checked={autoSave}
                onCheckedChange={setAutoSave}
              />
            </div>

            <Separator />

            {/* Auto Save Interval */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>{t('editorTab.autoSaveInterval')}</Label>
                <span className="text-sm text-zinc-500">
                  {(autoSaveInterval / 1000).toFixed(1)}s
                </span>
              </div>
              <Slider
                value={[autoSaveInterval]}
                onValueChange={([v]) => setAutoSaveInterval(v)}
                min={300}
                max={5000}
                step={100}
                disabled={!autoSave}
              />
              <div className="flex justify-between text-xs text-zinc-400">
                <span>0.3s</span>
                <span>5.0s</span>
              </div>
            </div>
            <Separator />

            {/* Restart Tour */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('editorTab.restartTour')}</Label>
                <p className="text-xs text-zinc-400">{t('editorTab.restartTourDescription')}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer"
                onClick={() => {
                  closeModal();
                  setTimeout(() => startTour('editor', 5), 300);
                }}
              >
                {t('editorTab.restartTour')}
              </Button>
            </div>
          </TabsContent>

          {/* MCP Tab */}
          <TabsContent value="mcp" className="px-6 pb-6 pt-4">
            <McpSettingsPanel />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
