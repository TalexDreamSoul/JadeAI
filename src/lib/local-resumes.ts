import { DEFAULT_SECTIONS, DEFAULT_TEMPLATE } from '@/lib/constants';
import { generateId } from '@/lib/utils';
import { DEFAULT_THEME_CONFIG, normalizeThemeConfig } from '@/lib/theme-config';
import type { Resume, ResumeSection, SectionContent } from '@/types/resume';

const LOCAL_RESUMES_KEY = 'touchresume_local_resumes';
const LOCAL_ID_PREFIX = 'local_';

export interface LocalResumeInput {
  title?: string;
  template?: string;
  language?: string;
  themeConfig?: unknown;
  sections?: unknown[];
  isBase?: boolean;
  cloudSyncEnabled?: boolean;
  baseResumeId?: string | null;
  targetCompany?: string | null;
  targetJobTitle?: string | null;
  jobDescription?: string | null;
  versionLabel?: string;
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

export function isLocalResumeId(id?: string | null): boolean {
  return typeof id === 'string' && id.startsWith(LOCAL_ID_PREFIX);
}

function parseDate(value: unknown, fallback = new Date()): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (Number.isFinite(date.getTime())) return date;
  }
  return fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function defaultContent(type: string): SectionContent {
  if (type === 'personal_info') {
    return { fullName: '', jobTitle: '', email: '', phone: '', location: '' };
  }
  if (type === 'summary') {
    return { text: '' };
  }
  if (type === 'skills') {
    return { categories: [] };
  }
  return { items: [] } as SectionContent;
}

function normalizeSection(value: unknown, resumeId: string, sortOrder: number): ResumeSection {
  const section = asRecord(value);
  const now = new Date();
  const type = typeof section.type === 'string' ? section.type : 'custom';

  return {
    id: typeof section.id === 'string' ? section.id : `${LOCAL_ID_PREFIX}section_${generateId()}`,
    resumeId,
    type,
    title: typeof section.title === 'string' ? section.title : type,
    sortOrder: typeof section.sortOrder === 'number' ? section.sortOrder : sortOrder,
    visible: typeof section.visible === 'boolean' ? section.visible : true,
    content: section.content !== undefined ? (section.content as SectionContent) : defaultContent(type),
    createdAt: parseDate(section.createdAt, now),
    updatedAt: parseDate(section.updatedAt, now),
  };
}

function createDefaultSections(resumeId: string, language: string): ResumeSection[] {
  const now = new Date();
  return DEFAULT_SECTIONS.map((section, index) => ({
    id: `${LOCAL_ID_PREFIX}section_${generateId()}`,
    resumeId,
    type: section.type,
    title: language === 'en' ? section.titleEn : section.titleZh,
    sortOrder: index,
    visible: true,
    content: defaultContent(section.type),
    createdAt: now,
    updatedAt: now,
  }));
}

function normalizeResume(value: unknown): Resume | null {
  const raw = asRecord(value);
  if (typeof raw.id !== 'string') return null;

  const now = new Date();
  const language = typeof raw.language === 'string' ? raw.language : 'zh';
  const sections = Array.isArray(raw.sections)
    ? raw.sections.map((section, index) => normalizeSection(section, raw.id as string, index))
    : [];

  return {
    id: raw.id,
    userId: typeof raw.userId === 'string' ? raw.userId : 'local',
    title: typeof raw.title === 'string' ? raw.title : '未命名简历',
    template: typeof raw.template === 'string' ? raw.template : DEFAULT_TEMPLATE,
    themeConfig: normalizeThemeConfig(raw.themeConfig),
    isDefault: typeof raw.isDefault === 'boolean' ? raw.isDefault : false,
    isBase: typeof raw.isBase === 'boolean' ? raw.isBase : false,
    cloudSyncEnabled: false,
    language,
    sourceResumeId: typeof raw.sourceResumeId === 'string' ? raw.sourceResumeId : null,
    baseResumeId: typeof raw.baseResumeId === 'string' ? raw.baseResumeId : null,
    targetCompany: typeof raw.targetCompany === 'string' ? raw.targetCompany : null,
    targetJobTitle: typeof raw.targetJobTitle === 'string' ? raw.targetJobTitle : null,
    jobDescription: typeof raw.jobDescription === 'string' ? raw.jobDescription : null,
    versionLabel: typeof raw.versionLabel === 'string' ? raw.versionLabel : 'local',
    sections,
    createdAt: parseDate(raw.createdAt, now),
    updatedAt: parseDate(raw.updatedAt, now),
  };
}

function readLocalResumes(): Resume[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(LOCAL_RESUMES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeResume)
      .filter((resume): resume is Resume => !!resume)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch {
    return [];
  }
}

function writeLocalResumes(resumes: Resume[]) {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(LOCAL_RESUMES_KEY, JSON.stringify(resumes));
  } catch {
    // Ignore quota/private-mode errors.
  }
}

export function getLocalResumes(): Resume[] {
  return readLocalResumes();
}

export function getLocalResume(id: string): Resume | null {
  return readLocalResumes().find((resume) => resume.id === id) || null;
}

export function createLocalResume(input: LocalResumeInput = {}): Resume {
  const id = `${LOCAL_ID_PREFIX}${generateId()}`;
  const now = new Date();
  const language = input.language || 'zh';
  const sections = Array.isArray(input.sections) && input.sections.length > 0
    ? input.sections.map((section, index) => normalizeSection(section, id, index))
    : createDefaultSections(id, language);

  const resume: Resume = {
    id,
    userId: 'local',
    title: input.title || '未命名简历',
    template: input.template || DEFAULT_TEMPLATE,
    themeConfig: normalizeThemeConfig(input.themeConfig),
    isDefault: false,
    isBase: input.isBase ?? false,
    cloudSyncEnabled: false,
    language,
    sourceResumeId: null,
    baseResumeId: input.baseResumeId ?? null,
    targetCompany: input.targetCompany ?? null,
    targetJobTitle: input.targetJobTitle ?? null,
    jobDescription: input.jobDescription ?? null,
    versionLabel: input.versionLabel || 'local',
    sections,
    createdAt: now,
    updatedAt: now,
  };

  writeLocalResumes([resume, ...readLocalResumes()]);
  return resume;
}

export function updateLocalResume(id: string, input: LocalResumeInput): Resume | null {
  const resumes = readLocalResumes();
  const index = resumes.findIndex((resume) => resume.id === id);
  if (index < 0) return null;

  const current = resumes[index];
  const now = new Date();
  const sections = Array.isArray(input.sections)
    ? input.sections.map((section, sectionIndex) => normalizeSection(section, id, sectionIndex))
    : current.sections;

  const updated: Resume = {
    ...current,
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.template !== undefined ? { template: input.template } : {}),
    ...(input.language !== undefined ? { language: input.language } : {}),
    ...(input.themeConfig !== undefined ? { themeConfig: normalizeThemeConfig(input.themeConfig) } : {}),
    ...(input.isBase !== undefined ? { isBase: input.isBase } : {}),
    ...(input.baseResumeId !== undefined ? { baseResumeId: input.baseResumeId } : {}),
    ...(input.targetCompany !== undefined ? { targetCompany: input.targetCompany } : {}),
    ...(input.targetJobTitle !== undefined ? { targetJobTitle: input.targetJobTitle } : {}),
    ...(input.jobDescription !== undefined ? { jobDescription: input.jobDescription } : {}),
    ...(input.versionLabel !== undefined ? { versionLabel: input.versionLabel } : {}),
    cloudSyncEnabled: false,
    sections,
    updatedAt: now,
  };

  resumes[index] = updated;
  writeLocalResumes(resumes);
  return updated;
}

export function deleteLocalResume(id: string): boolean {
  const resumes = readLocalResumes();
  const next = resumes.filter((resume) => resume.id !== id);
  writeLocalResumes(next);
  return next.length !== resumes.length;
}

export function upsertLocalResume(id: string, input: LocalResumeInput): Resume {
  const resumes = readLocalResumes();
  const existingIndex = resumes.findIndex((resume) => resume.id === id);
  const now = new Date();
  const language = input.language || (existingIndex >= 0 ? resumes[existingIndex].language : 'zh');
  const sections = Array.isArray(input.sections) && input.sections.length > 0
    ? input.sections.map((section, index) => normalizeSection(section, id, index))
    : existingIndex >= 0
      ? resumes[existingIndex].sections
      : createDefaultSections(id, language);

  const resume: Resume = {
    ...(existingIndex >= 0 ? resumes[existingIndex] : {
      id,
      userId: 'local',
      title: '未命名简历',
      template: DEFAULT_TEMPLATE,
      themeConfig: DEFAULT_THEME_CONFIG,
      isDefault: false,
      isBase: false,
      cloudSyncEnabled: false,
      language,
      sourceResumeId: null,
      baseResumeId: null,
      targetCompany: null,
      targetJobTitle: null,
      jobDescription: null,
      versionLabel: 'local',
      sections: [],
      createdAt: now,
      updatedAt: now,
    }),
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.template !== undefined ? { template: input.template } : {}),
    ...(input.language !== undefined ? { language: input.language } : {}),
    ...(input.themeConfig !== undefined ? { themeConfig: normalizeThemeConfig(input.themeConfig) } : {}),
    ...(input.isBase !== undefined ? { isBase: input.isBase } : {}),
    ...(input.baseResumeId !== undefined ? { baseResumeId: input.baseResumeId } : {}),
    ...(input.targetCompany !== undefined ? { targetCompany: input.targetCompany } : {}),
    ...(input.targetJobTitle !== undefined ? { targetJobTitle: input.targetJobTitle } : {}),
    ...(input.jobDescription !== undefined ? { jobDescription: input.jobDescription } : {}),
    ...(input.versionLabel !== undefined ? { versionLabel: input.versionLabel } : {}),
    id,
    userId: 'local',
    cloudSyncEnabled: false,
    sections,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    resumes[existingIndex] = resume;
  } else {
    resumes.unshift(resume);
  }
  writeLocalResumes(resumes);
  return resume;
}

export function replaceLocalResumeId(oldId: string, nextId: string): Resume | null {
  const resumes = readLocalResumes();
  const index = resumes.findIndex((resume) => resume.id === oldId);
  if (index < 0) return null;
  const updated = upsertLocalResume(nextId, resumes[index]);
  writeLocalResumes(readLocalResumes().filter((resume) => resume.id !== oldId));
  return updated;
}

export function duplicateLocalResume(id: string): Resume | null {
  const original = getLocalResume(id);
  if (!original) return null;

  return createLocalResume({
    title: `${original.title} (副本)`,
    template: original.template,
    language: original.language,
    themeConfig: original.themeConfig,
    sections: original.sections.map((section) => ({
      ...section,
      id: `${LOCAL_ID_PREFIX}section_${generateId()}`,
    })),
  });
}
