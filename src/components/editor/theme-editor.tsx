'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  Palette,
  Type,
  Space,
  Sparkles,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  LayoutGrid,
  Check,
  Minus,
  Code2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useResumeStore } from '@/stores/resume-store';
import { RECOMMENDED_TEMPLATES, TEMPLATES } from '@/lib/constants';
import { getTemplateLabel } from '@/lib/template-labels';
import { TemplateThumbnail } from '@/components/dashboard/template-thumbnail';
import { cn } from '@/lib/utils';
import type { ThemeConfig } from '@/types/resume';

// -- Preset Themes --

interface PresetTheme {
  id: string;
  colors: [string, string, string, string];
  config: ThemeConfig;
}

const PRESET_THEMES: PresetTheme[] = [
  {
    id: 'classic',
    colors: ['#1a1a1a', '#3b82f6', '#ffffff', '#374151'],
    config: {
      primaryColor: '#1a1a1a',
      accentColor: '#3b82f6',
      fontFamily: 'Georgia',
      fontSize: 'medium',
      lineSpacing: 1.5,
      margin: { top: 24, right: 24, bottom: 24, left: 24 },
      sectionSpacing: 16,
    },
  },
  {
    id: 'modern',
    colors: ['#0f172a', '#6366f1', '#f8fafc', '#475569'],
    config: {
      primaryColor: '#0f172a',
      accentColor: '#6366f1',
      fontFamily: 'Inter',
      fontSize: 'medium',
      lineSpacing: 1.6,
      margin: { top: 20, right: 20, bottom: 20, left: 20 },
      sectionSpacing: 14,
    },
  },
  {
    id: 'minimal',
    colors: ['#27272a', '#a1a1aa', '#ffffff', '#52525b'],
    config: {
      primaryColor: '#27272a',
      accentColor: '#a1a1aa',
      fontFamily: 'Helvetica',
      fontSize: 'small',
      lineSpacing: 1.4,
      margin: { top: 28, right: 28, bottom: 28, left: 28 },
      sectionSpacing: 12,
    },
  },
  {
    id: 'elegant',
    colors: ['#1c1917', '#b45309', '#fffbeb', '#57534e'],
    config: {
      primaryColor: '#1c1917',
      accentColor: '#b45309',
      fontFamily: 'Palatino',
      fontSize: 'medium',
      lineSpacing: 1.6,
      margin: { top: 26, right: 26, bottom: 26, left: 26 },
      sectionSpacing: 18,
    },
  },
  {
    id: 'bold',
    colors: ['#020617', '#e11d48', '#fff1f2', '#334155'],
    config: {
      primaryColor: '#020617',
      accentColor: '#e11d48',
      fontFamily: 'Arial',
      fontSize: 'large',
      lineSpacing: 1.5,
      margin: { top: 20, right: 20, bottom: 20, left: 20 },
      sectionSpacing: 16,
    },
  },
  {
    id: 'creative',
    colors: ['#134e4a', '#0d9488', '#f0fdfa', '#115e59'],
    config: {
      primaryColor: '#134e4a',
      accentColor: '#0d9488',
      fontFamily: 'Verdana',
      fontSize: 'medium',
      lineSpacing: 1.5,
      margin: { top: 22, right: 22, bottom: 22, left: 22 },
      sectionSpacing: 14,
    },
  },
  {
    id: 'mint',
    colors: ['#0A1F44', '#00C897', '#F5FBFA', '#334155'],
    config: {
      primaryColor: '#0A1F44',
      accentColor: '#00C897',
      fontFamily: 'Inter',
      fontSize: 'medium',
      lineSpacing: 1.55,
      margin: { top: 22, right: 22, bottom: 22, left: 22 },
      sectionSpacing: 15,
    },
  },
];

const DEFAULT_THEME: ThemeConfig = {
  primaryColor: '#1a1a1a',
  accentColor: '#3b82f6',
  fontFamily: 'Inter',
  fontSize: 'medium',
  lineSpacing: 1.5,
  margin: { top: 20, right: 20, bottom: 20, left: 20 },
  sectionSpacing: 16,
  avatarStyle: 'oneInch',
};

const FONT_OPTIONS = [
  'Inter',
  'Georgia',
  'Helvetica',
  'Arial',
  'Palatino',
  'Verdana',
  'Times New Roman',
  'Garamond',
  'Courier New',
];

const FONT_SIZE_OPTIONS = [
  { value: 'small', label: '' },
  { value: 'medium', label: '' },
  { value: 'large', label: '' },
];

const TITLE_ALIGN_OPTIONS = ['left', 'center', 'right'] as const;
const TITLE_WEIGHT_OPTIONS = [400, 500, 600, 700, 800, 900];
const DIVIDER_STYLE_OPTIONS = ['solid', 'dashed', 'dotted', 'double'] as const;
const THEME_EDITOR_WIDTH_KEY = 'touchresume_theme_editor_width';
const THEME_EDITOR_DEFAULT_WIDTH = 360;
const THEME_EDITOR_MIN_WIDTH = 300;
const THEME_EDITOR_MAX_WIDTH = 640;

function clampThemeEditorWidth(value: number): number {
  return Math.max(THEME_EDITOR_MIN_WIDTH, Math.min(THEME_EDITOR_MAX_WIDTH, value));
}

function getStoredThemeEditorWidth(): number {
  if (typeof window === 'undefined') return THEME_EDITOR_DEFAULT_WIDTH;
  const raw = Number(localStorage.getItem(THEME_EDITOR_WIDTH_KEY));
  return Number.isFinite(raw) && raw > 0 ? clampThemeEditorWidth(raw) : THEME_EDITOR_DEFAULT_WIDTH;
}

// -- Color Picker Component --

function ColorPickerField({
  label,
  value,
  onChange,
  fallback = '#000000',
}: {
  label: string;
  value?: string;
  onChange: (color: string) => void;
  fallback?: string;
}) {
  const displayValue = value || fallback;

  return (
    <div className="flex items-center justify-between">
      <Label className="text-xs text-zinc-600 dark:text-zinc-400">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex cursor-pointer items-center gap-2 rounded-md border border-zinc-200 px-2 py-1 text-xs transition-colors hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
          >
            <div
              className="h-4 w-4 rounded-sm border border-zinc-200"
              style={{ backgroundColor: displayValue }}
            />
            <span className="font-mono text-zinc-500">{displayValue}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-3" align="end">
          <div className="space-y-3">
            <input
              type="color"
              value={displayValue}
              onChange={(e) => onChange(e.target.value)}
              className="h-8 w-full cursor-pointer rounded border-0 p-0"
            />
            <Input
              value={value || ''}
              onChange={(e) => {
                const v = e.target.value;
                if (/^#[0-9a-fA-F]{0,6}$/.test(v)) {
                  onChange(v);
                }
              }}
              placeholder="#000000"
              className="font-mono text-xs"
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// -- Collapsible Section --

function ThemeSection({
  icon: Icon,
  title,
  children,
  defaultOpen = true,
  open,
  onOpenChange,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isOpen = open ?? uncontrolledOpen;

  const toggleOpen = () => {
    const next = !isOpen;
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  return (
    <div>
      <button
        type="button"
        onClick={toggleOpen}
        className="flex w-full cursor-pointer items-center gap-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
      >
        {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <Icon className="h-3.5 w-3.5" />
        <span>{title}</span>
      </button>
      {isOpen && <div className="space-y-3 pb-3 pl-5">{children}</div>}
    </div>
  );
}

// -- Main Theme Editor --

interface ThemeEditorProps {
  onClose?: () => void;
}

export function ThemeEditor({}: ThemeEditorProps) {
  const t = useTranslations('themeEditor');
  const tRoot = useTranslations();
  const { currentResume } = useResumeStore();
  const [panelWidth, setPanelWidth] = useState(THEME_EDITOR_DEFAULT_WIDTH);

  useEffect(() => {
    setPanelWidth(getStoredThemeEditorWidth());
  }, []);

  const startResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = panelWidth;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = clampThemeEditorWidth(startWidth + moveEvent.clientX - startX);
      setPanelWidth(nextWidth);
      try {
        localStorage.setItem(THEME_EDITOR_WIDTH_KEY, String(nextWidth));
      } catch {
        // ignore
      }
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [panelWidth]);

  const themeConfig: ThemeConfig = useMemo(
    () => ({
      ...DEFAULT_THEME,
      ...(currentResume?.themeConfig || {}),
    }),
    [currentResume?.themeConfig]
  );

  const updateTheme = useCallback(
    (updates: Partial<ThemeConfig>) => {
      if (!currentResume) return;
      const newConfig = { ...themeConfig, ...updates };
      useResumeStore.setState((state) => ({
        currentResume: state.currentResume
          ? { ...state.currentResume, themeConfig: newConfig }
          : null,
        isDirty: true,
      }));
      // Trigger autosave
      useResumeStore.getState()._scheduleSave();
    },
    [currentResume, themeConfig]
  );

  const updateTitleStyle = useCallback(
    (updates: NonNullable<ThemeConfig['titleStyle']>) => {
      updateTheme({ titleStyle: { ...(themeConfig.titleStyle || {}), ...updates } });
    },
    [themeConfig.titleStyle, updateTheme]
  );

  const updateSectionTitleStyle = useCallback(
    (updates: NonNullable<ThemeConfig['sectionTitleStyle']>) => {
      updateTheme({ sectionTitleStyle: { ...(themeConfig.sectionTitleStyle || {}), ...updates } });
    },
    [themeConfig.sectionTitleStyle, updateTheme]
  );

  const updateSectionDivider = useCallback(
    (updates: NonNullable<ThemeConfig['sectionDivider']>) => {
      updateTheme({ sectionDivider: { ...(themeConfig.sectionDivider || {}), ...updates } });
    },
    [themeConfig.sectionDivider, updateTheme]
  );

  const updateLayout = useCallback(
    (updates: NonNullable<ThemeConfig['layout']>) => {
      updateTheme({ layout: { ...(themeConfig.layout || {}), ...updates } });
    },
    [themeConfig.layout, updateTheme]
  );

  const updateAdvanced = useCallback(
    (updates: NonNullable<ThemeConfig['advanced']>) => {
      updateTheme({ advanced: { ...(themeConfig.advanced || {}), ...updates } });
    },
    [themeConfig.advanced, updateTheme]
  );

  const setPanelSectionOpen = useCallback(
    (key: string, open: boolean) => {
      updateTheme({
        editorPanel: {
          ...(themeConfig.editorPanel || {}),
          openSections: {
            ...(themeConfig.editorPanel?.openSections || {}),
            [key]: open,
          },
        },
      });
    },
    [themeConfig.editorPanel, updateTheme]
  );

  const isPanelSectionOpen = useCallback(
    (key: string, fallback: boolean) => themeConfig.editorPanel?.openSections?.[key] ?? fallback,
    [themeConfig.editorPanel]
  );

  const applyPreset = useCallback(
    (preset: PresetTheme) => {
      updateTheme(preset.config);
    },
    [updateTheme]
  );

  const resetTheme = useCallback(() => {
    updateTheme(DEFAULT_THEME);
  }, [updateTheme]);

  const handleTemplateSwitch = useCallback(
    (tpl: string) => {
      useResumeStore.getState().setTemplate(tpl);
    },
    []
  );

  // Build font size label dynamically
  const fontSizeLabels: Record<string, string> = {
    small: t('fontSize.small'),
    medium: t('fontSize.medium'),
    large: t('fontSize.large'),
  };

  return (
    <div
      className="relative flex h-full min-w-[300px] max-w-[640px] shrink-0 flex-col border-l bg-white dark:bg-zinc-900 dark:border-zinc-800"
      style={{ width: panelWidth }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        title={t('resizePanel')}
        onPointerDown={startResize}
        className="absolute right-0 top-0 z-20 h-full w-1.5 translate-x-1/2 cursor-col-resize touch-none bg-transparent transition-colors hover:bg-brand/30"
      />
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 dark:border-zinc-800">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <Palette className="h-4 w-4 text-zinc-500" />
          {t('title')}
        </h3>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={resetTheme}
          title={t('reset')}
          className="cursor-pointer text-zinc-400 hover:text-zinc-600"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
        <div className="min-w-[340px] px-4 py-3 space-y-1">
          {/* Template Switcher */}
          <ThemeSection
            icon={LayoutGrid}
            title={t('templateSection')}
            defaultOpen={false}
            open={isPanelSectionOpen('template', false)}
            onOpenChange={(open) => setPanelSectionOpen('template', open)}
          >
            <div className="grid max-h-[320px] grid-cols-3 gap-2 overflow-y-auto pr-1">
              {TEMPLATES.map((tpl) => {
                const isSelected = currentResume?.template === tpl;
                return (
                  <button
                    key={tpl}
                    type="button"
                    className={cn(
                      'group/tpl relative cursor-pointer overflow-hidden rounded-lg border-2 transition-all duration-200',
                      isSelected
                        ? 'border-brand shadow-sm shadow-brand/10'
                        : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600'
                    )}
                    onClick={() => handleTemplateSwitch(tpl)}
                  >
                    <div className="relative bg-zinc-50 p-1 dark:bg-zinc-800/50">
                      <TemplateThumbnail
                        template={tpl}
                        className="mx-auto h-[56px] w-[40px] shadow-sm ring-1 ring-zinc-200/50"
                      />
                      {RECOMMENDED_TEMPLATES.has(tpl) && (
                        <div className="absolute left-0.5 top-0.5 rounded-full bg-brand px-1 py-0.5 text-[8px] font-semibold leading-none text-white">
                          {tRoot('templates.recommended')}
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-white shadow-sm">
                          <Check className="h-2.5 w-2.5" />
                        </div>
                      )}
                    </div>
                    <div className={cn(
                      'truncate px-1 py-0.5 text-center text-[10px] font-medium transition-colors',
                      isSelected
                        ? 'bg-brand-muted text-brand dark:bg-brand-muted dark:text-brand'
                        : 'text-zinc-500 dark:text-zinc-400'
                    )}>
                      {getTemplateLabel(tpl, tRoot)}
                    </div>
                  </button>
                );
              })}
            </div>
          </ThemeSection>

          <Separator />

          {/* Preset Themes */}
          <ThemeSection
            icon={Sparkles}
            title={t('presets')}
            open={isPanelSectionOpen('presets', true)}
            onOpenChange={(open) => setPanelSectionOpen('presets', open)}
          >
            <div className="grid grid-cols-3 gap-2">
              {PRESET_THEMES.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="group flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-zinc-200 p-2 transition-all hover:border-zinc-400 hover:shadow-sm dark:border-zinc-700 dark:hover:border-zinc-500"
                  title={t(`preset.${preset.id}`)}
                >
                  <div className="flex gap-0.5">
                    {preset.colors.map((color, i) => (
                      <div
                        key={i}
                        className="h-3 w-3 rounded-full border border-zinc-200"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-zinc-500 group-hover:text-zinc-700 dark:text-zinc-400 dark:group-hover:text-zinc-200">
                    {t(`preset.${preset.id}`)}
                  </span>
                </button>
              ))}
            </div>
          </ThemeSection>

          <Separator />

          {/* Colors */}
          <ThemeSection
            icon={Palette}
            title={t('colors')}
            open={isPanelSectionOpen('colors', true)}
            onOpenChange={(open) => setPanelSectionOpen('colors', open)}
          >
            <ColorPickerField
              label={t('primaryColor')}
              value={themeConfig.primaryColor}
              onChange={(color) => updateTheme({ primaryColor: color })}
            />
            <ColorPickerField
              label={t('accentColor')}
              value={themeConfig.accentColor}
              onChange={(color) => updateTheme({ accentColor: color })}
            />
          </ThemeSection>

          <Separator />

          {/* Typography */}
          <ThemeSection
            icon={Type}
            title={t('typography')}
            open={isPanelSectionOpen('typography', true)}
            onOpenChange={(open) => setPanelSectionOpen('typography', open)}
          >
            {/* Header Font */}
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-600 dark:text-zinc-400">{t('fontFamily')}</Label>
              <Select
                value={themeConfig.fontFamily}
                onValueChange={(v) => updateTheme({ fontFamily: v })}
              >
                <SelectTrigger className="w-full h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map((font) => (
                    <SelectItem key={font} value={font}>
                      <span style={{ fontFamily: font }}>{font}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Font Size */}
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-600 dark:text-zinc-400">{t('fontSizeLabel')}</Label>
              <div className="grid grid-cols-3 gap-1">
                {FONT_SIZE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateTheme({ fontSize: opt.value })}
                    className={`cursor-pointer rounded-md border px-2 py-1 text-xs transition-all ${
                      themeConfig.fontSize === opt.value
                        ? 'border-zinc-900 bg-zinc-50 font-medium text-zinc-900 dark:border-zinc-400 dark:bg-zinc-800 dark:text-zinc-100'
                        : 'border-zinc-200 text-zinc-500 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600'
                    }`}
                  >
                    {fontSizeLabels[opt.value]}
                  </button>
                ))}
              </div>
            </div>

            {/* Line Spacing */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-zinc-600 dark:text-zinc-400">{t('lineSpacing')}</Label>
                <span className="text-xs text-zinc-400">{themeConfig.lineSpacing.toFixed(1)}</span>
              </div>
              <Slider
                value={[themeConfig.lineSpacing]}
                onValueChange={([v]) => updateTheme({ lineSpacing: v })}
                min={1.0}
                max={2.5}
                step={0.1}
              />
            </div>
          </ThemeSection>

          <Separator />

          {/* Template Title */}
          <ThemeSection
            icon={Type}
            title={t('titleStyle')}
            defaultOpen={false}
            open={isPanelSectionOpen('titleStyle', false)}
            onOpenChange={(open) => setPanelSectionOpen('titleStyle', open)}
          >
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-600 dark:text-zinc-400">{t('titleAlign')}</Label>
              <Select
                value={themeConfig.titleStyle?.align || 'inherit'}
                onValueChange={(v) => updateTitleStyle({ align: v === 'inherit' ? undefined : v as 'left' | 'center' | 'right' })}
              >
                <SelectTrigger className="h-8 w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inherit">{t('inherit')}</SelectItem>
                  {TITLE_ALIGN_OPTIONS.map((align) => (
                    <SelectItem key={align} value={align}>{t(`align.${align}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-600 dark:text-zinc-400">{t('titleWeight')}</Label>
              <Select
                value={themeConfig.titleStyle?.fontWeight ? String(themeConfig.titleStyle.fontWeight) : 'inherit'}
                onValueChange={(v) => updateTitleStyle({ fontWeight: v === 'inherit' ? undefined : Number(v) })}
              >
                <SelectTrigger className="h-8 w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inherit">{t('inherit')}</SelectItem>
                  {TITLE_WEIGHT_OPTIONS.map((weight) => (
                    <SelectItem key={weight} value={String(weight)}>{weight}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-600 dark:text-zinc-400">{t('titleSize')}</Label>
                <Input
                  type="number"
                  value={themeConfig.titleStyle?.fontSize ?? ''}
                  onChange={(e) => updateTitleStyle({ fontSize: e.target.value === '' ? undefined : Math.max(14, Math.min(72, Number(e.target.value) || 0)) })}
                  placeholder={t('auto')}
                  min={14}
                  max={72}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-600 dark:text-zinc-400">{t('titleMarginBottom')}</Label>
                <Input
                  type="number"
                  value={themeConfig.titleStyle?.marginBottom ?? ''}
                  onChange={(e) => updateTitleStyle({ marginBottom: e.target.value === '' ? undefined : Math.max(0, Math.min(64, Number(e.target.value) || 0)) })}
                  placeholder={t('auto')}
                  min={0}
                  max={64}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <ColorPickerField
              label={t('titleColor')}
              value={themeConfig.titleStyle?.color}
              fallback={themeConfig.primaryColor}
              onChange={(color) => updateTitleStyle({ color })}
            />
          </ThemeSection>

          <Separator />

          {/* Section Headings and Dividers */}
          <ThemeSection
            icon={Minus}
            title={t('sectionHeading')}
            defaultOpen={false}
            open={isPanelSectionOpen('sectionHeading', false)}
            onOpenChange={(open) => setPanelSectionOpen('sectionHeading', open)}
          >
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs text-zinc-600 dark:text-zinc-400">{t('showDivider')}</Label>
                <p className="mt-0.5 text-[10px] text-zinc-400">{t('showDividerHint')}</p>
              </div>
              <Switch
                checked={themeConfig.sectionDivider?.enabled !== false}
                onCheckedChange={(checked) => updateSectionDivider({ enabled: checked })}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-600 dark:text-zinc-400">{t('dividerStyle')}</Label>
              <Select
                value={themeConfig.sectionDivider?.style || 'solid'}
                onValueChange={(v) => updateSectionDivider({ enabled: true, style: v as 'solid' | 'dashed' | 'dotted' | 'double' })}
              >
                <SelectTrigger className="h-8 w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIVIDER_STYLE_OPTIONS.map((style) => (
                    <SelectItem key={style} value={style}>{t(`divider.${style}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-zinc-600 dark:text-zinc-400">{t('dividerThickness')}</Label>
                <span className="text-xs text-zinc-400">{themeConfig.sectionDivider?.thickness ?? 1}px</span>
              </div>
              <Slider
                value={[themeConfig.sectionDivider?.thickness ?? 1]}
                onValueChange={([v]) => updateSectionDivider({ enabled: true, thickness: v })}
                min={0}
                max={8}
                step={1}
              />
            </div>

            <ColorPickerField
              label={t('dividerColor')}
              value={themeConfig.sectionDivider?.color}
              fallback={themeConfig.accentColor}
              onChange={(color) => updateSectionDivider({ enabled: true, color })}
            />

            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-600 dark:text-zinc-400">{t('sectionTitleWeight')}</Label>
              <Select
                value={themeConfig.sectionTitleStyle?.fontWeight ? String(themeConfig.sectionTitleStyle.fontWeight) : 'inherit'}
                onValueChange={(v) => updateSectionTitleStyle({ fontWeight: v === 'inherit' ? undefined : Number(v) })}
              >
                <SelectTrigger className="h-8 w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inherit">{t('inherit')}</SelectItem>
                  {TITLE_WEIGHT_OPTIONS.map((weight) => (
                    <SelectItem key={weight} value={String(weight)}>{weight}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ColorPickerField
              label={t('sectionTitleColor')}
              value={themeConfig.sectionTitleStyle?.color}
              fallback={themeConfig.primaryColor}
              onChange={(color) => updateSectionTitleStyle({ color })}
            />
          </ThemeSection>

          <Separator />

          {/* Spacing */}
          <ThemeSection
            icon={Space}
            title={t('spacing')}
            open={isPanelSectionOpen('spacing', true)}
            onOpenChange={(open) => setPanelSectionOpen('spacing', open)}
          >
            {/* Section Spacing */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-zinc-600 dark:text-zinc-400">{t('sectionSpacing')}</Label>
                <span className="text-xs text-zinc-400">{themeConfig.sectionSpacing}px</span>
              </div>
              <Slider
                value={[themeConfig.sectionSpacing]}
                onValueChange={([v]) => updateTheme({ sectionSpacing: v })}
                min={4}
                max={32}
                step={2}
              />
            </div>

            {/* Page Margin */}
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-600 dark:text-zinc-400">{t('pageMargin')}</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
                  <div key={side} className="space-y-0.5">
                    <span className="text-[10px] text-zinc-400 block text-center">{t(`margin.${side}`)}</span>
                    <Input
                      type="number"
                      value={themeConfig.margin[side]}
                      onChange={(e) =>
                        updateTheme({
                          margin: {
                            ...themeConfig.margin,
                            [side]: Math.max(0, Math.min(60, Number(e.target.value) || 0)),
                          },
                        })
                      }
                      min={0}
                      max={60}
                      className="h-7 text-xs text-center px-1"
                    />
                  </div>
                ))}
              </div>
            </div>
          </ThemeSection>

          <Separator />

          {/* Advanced */}
          <ThemeSection
            icon={Code2}
            title={t('advanced')}
            defaultOpen={false}
            open={isPanelSectionOpen('advanced', false)}
            onOpenChange={(open) => setPanelSectionOpen('advanced', open)}
          >
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-600 dark:text-zinc-400">{t('contentMaxWidth')}</Label>
                <Input
                  type="number"
                  value={themeConfig.layout?.contentMaxWidth ?? ''}
                  onChange={(e) => updateLayout({ contentMaxWidth: e.target.value === '' ? undefined : Math.max(480, Math.min(1200, Number(e.target.value) || 0)) })}
                  placeholder={t('auto')}
                  min={480}
                  max={1200}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-600 dark:text-zinc-400">{t('borderRadius')}</Label>
                <Input
                  type="number"
                  value={themeConfig.layout?.borderRadius ?? ''}
                  onChange={(e) => updateLayout({ borderRadius: e.target.value === '' ? undefined : Math.max(0, Math.min(48, Number(e.target.value) || 0)) })}
                  placeholder={t('auto')}
                  min={0}
                  max={48}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <ColorPickerField
              label={t('backgroundColor')}
              value={themeConfig.layout?.backgroundColor}
              fallback="#ffffff"
              onChange={(color) => updateLayout({ backgroundColor: color })}
            />

            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-600 dark:text-zinc-400">{t('customCss')}</Label>
              <Textarea
                value={themeConfig.advanced?.customCss || ''}
                onChange={(e) => updateAdvanced({ customCss: e.target.value })}
                placeholder={t('customCssPlaceholder')}
                className="min-h-28 font-mono text-[11px]"
                spellCheck={false}
              />
              <p className="text-[10px] leading-relaxed text-zinc-400">{t('customCssHint')}</p>
            </div>
          </ThemeSection>
        </div>
      </div>
    </div>
  );
}
