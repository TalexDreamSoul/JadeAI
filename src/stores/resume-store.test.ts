import { afterEach, describe, expect, it, vi } from 'vitest';
import { useResumeStore } from './resume-store';
import type { Resume } from '@/types/resume';

const resume: Resume = {
  id: 'resume-save-test',
  userId: 'user-save-test',
  title: 'Save test',
  template: 'touch-pure',
  themeConfig: {
    primaryColor: '#111111',
    accentColor: '#3b82f6',
    fontFamily: 'Inter',
    fontSize: 'medium',
    lineSpacing: 1.5,
    margin: { top: 20, right: 20, bottom: 20, left: 20 },
    sectionSpacing: 16,
  },
  isDefault: false,
  cloudSyncEnabled: true,
  language: 'en',
  sections: [],
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

afterEach(() => {
  vi.restoreAllMocks();
  useResumeStore.getState().reset();
});

describe('resume store save result', () => {
  it('keeps the resume dirty and reports failure on a non-success response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 500 }));
    useResumeStore.setState({ currentResume: resume, sections: [], isDirty: true });

    const saved = await useResumeStore.getState().save();

    expect(saved).toBe(false);
    expect(useResumeStore.getState().isDirty).toBe(true);
  });

  it('clears the dirty state only after a successful response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    useResumeStore.setState({ currentResume: resume, sections: [], isDirty: true });

    const saved = await useResumeStore.getState().save();

    expect(saved).toBe(true);
    expect(useResumeStore.getState().isDirty).toBe(false);
  });
});
