import type { ThemeConfig } from '@/types/resume';

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  primaryColor: '#1a1a1a',
  accentColor: '#3b82f6',
  fontFamily: 'Inter',
  fontSize: 'medium',
  lineSpacing: 1.5,
  margin: { top: 20, right: 20, bottom: 20, left: 20 },
  sectionSpacing: 16,
  avatarStyle: 'oneInch',
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseThemeValue(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return isPlainObject(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  if (!isPlainObject(value)) return {};

  // Old SQLite/Drizzle edge case: JSON text was spread into an object and
  // persisted as {"0":"{","1":"}"...}. Reconstruct numeric keys first.
  const numericEntries = Object.entries(value)
    .filter(([key, char]) => /^\d+$/.test(key) && typeof char === 'string')
    .sort(([a], [b]) => Number(a) - Number(b));
  if (numericEntries.length > 0) {
    const candidate = numericEntries.map(([, char]) => char).join('');
    try {
      const parsed = JSON.parse(candidate);
      if (isPlainObject(parsed)) return { ...parsed, ...stripNumericKeys(value) };
    } catch {
      // fall back to object without numeric keys
    }
  }

  return stripNumericKeys(value);
}

function stripNumericKeys(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !/^\d+$/.test(key)));
}

export function normalizeThemeConfig(value: unknown): ThemeConfig {
  const raw = parseThemeValue(value);
  const margin = isPlainObject(raw.margin) ? raw.margin : {};
  const normalized: ThemeConfig = {
    ...DEFAULT_THEME_CONFIG,
    ...raw,
    margin: {
      ...DEFAULT_THEME_CONFIG.margin,
      ...margin,
    },
  } as ThemeConfig;
  return normalized;
}
