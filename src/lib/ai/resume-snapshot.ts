import type { Resume, ResumeSection } from '@/types/resume';

export type AIResumeSnapshot = Pick<
  Resume,
  'id' | 'title' | 'language' | 'sections' | 'targetCompany' | 'targetJobTitle' | 'jobDescription'
> & {
  userId?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function normalizeResumeSnapshot(value: unknown, fallbackId = 'local'): AIResumeSnapshot | null {
  const raw = asRecord(value);
  if (!raw || !Array.isArray(raw.sections)) return null;

  return {
    id: typeof raw.id === 'string' ? raw.id : fallbackId,
    userId: typeof raw.userId === 'string' ? raw.userId : undefined,
    title: typeof raw.title === 'string' ? raw.title : 'Local resume',
    language: typeof raw.language === 'string' ? raw.language : 'zh',
    targetCompany: typeof raw.targetCompany === 'string' ? raw.targetCompany : null,
    targetJobTitle: typeof raw.targetJobTitle === 'string' ? raw.targetJobTitle : null,
    jobDescription: typeof raw.jobDescription === 'string' ? raw.jobDescription : null,
    sections: raw.sections as ResumeSection[],
  };
}

export function getResumeSectionsContext(resume: { sections?: unknown }): string {
  return JSON.stringify(Array.isArray(resume.sections) ? resume.sections : []);
}
