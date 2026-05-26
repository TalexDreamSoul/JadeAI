import { normalizeThemeConfig } from '@/lib/theme-config';
import type { Resume } from '@/types/resume';

export function normalizeResumeSnapshotForUse(snapshot: unknown, fallback?: Partial<Resume>): Resume | null {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
  const raw = snapshot as Partial<Resume>;
  const sections = Array.isArray(raw.sections) ? raw.sections : [];
  return {
    ...(fallback || {}),
    ...raw,
    id: raw.id || fallback?.id || 'snapshot',
    userId: raw.userId || fallback?.userId || '',
    title: raw.title || fallback?.title || 'Resume snapshot',
    template: raw.template || fallback?.template || 'touch-pure',
    themeConfig: normalizeThemeConfig(raw.themeConfig),
    isDefault: raw.isDefault ?? fallback?.isDefault ?? false,
    isBase: raw.isBase ?? fallback?.isBase,
    cloudSyncEnabled: raw.cloudSyncEnabled ?? fallback?.cloudSyncEnabled,
    language: raw.language || fallback?.language || 'zh',
    sourceResumeId: raw.sourceResumeId ?? fallback?.sourceResumeId ?? null,
    baseResumeId: raw.baseResumeId ?? fallback?.baseResumeId ?? null,
    targetCompany: raw.targetCompany ?? fallback?.targetCompany ?? null,
    targetJobTitle: raw.targetJobTitle ?? fallback?.targetJobTitle ?? null,
    jobDescription: raw.jobDescription ?? fallback?.jobDescription ?? null,
    versionLabel: raw.versionLabel ?? fallback?.versionLabel,
    sections,
    createdAt: new Date(raw.createdAt || fallback?.createdAt || Date.now()),
    updatedAt: new Date(raw.updatedAt || fallback?.updatedAt || Date.now()),
  } as Resume;
}
