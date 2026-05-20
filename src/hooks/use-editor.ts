'use client';

import { useCallback, useEffect, useState } from 'react';
import { useResumeStore } from '@/stores/resume-store';
import { useEditorStore } from '@/stores/editor-store';
import { getLocalResume, isLocalResumeId } from '@/lib/local-resumes';
import { useIsLocalOnly } from '@/stores/settings-store';
import { normalizeThemeConfig } from '@/lib/theme-config';
import type { ResumeSection, SectionContent } from '@/types/resume';

function getHeaders() {
  const fingerprint = typeof window !== 'undefined' ? localStorage.getItem('touchresume_fingerprint') : null;
  return {
    'Content-Type': 'application/json',
    ...(fingerprint ? { 'x-fingerprint': fingerprint } : {}),
  };
}

export function useEditor(resumeId: string) {
  const localOnly = useIsLocalOnly();
  const [hasLoaded, setHasLoaded] = useState(false);
  const { setResume, sections, currentResume, updateSection, addSection, removeSection, reorderSections, reset: resetResume } = useResumeStore();
  const { pushSnapshot, reset: resetEditor } = useEditorStore();

  const loadResume = useCallback(async (options?: { soft?: boolean }) => {
    if (!options?.soft) {
      setHasLoaded(false);
      resetResume();
    }
    try {
      if (localOnly || isLocalResumeId(resumeId)) {
        const data = getLocalResume(resumeId);
        if (data) setResume(data);
        return;
      }

      const res = await fetch(`/api/resume/${resumeId}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setResume({
          ...data,
          sections: data.sections || [],
          themeConfig: normalizeThemeConfig(data.themeConfig),
          createdAt: new Date(data.createdAt),
          updatedAt: new Date(data.updatedAt),
        });
      }
    } catch (error) {
      console.error('Failed to load resume:', error);
    } finally {
      setHasLoaded(true);
    }
  }, [localOnly, resetResume, resumeId, setResume]);

  const refreshResume = useCallback(() => loadResume({ soft: true }), [loadResume]);

  useEffect(() => {
    loadResume();
    return () => {
      setHasLoaded(false);
      resetResume();
      resetEditor();
    };
  }, [loadResume, resetResume, resetEditor]);

  const handleUpdateSection = useCallback(
    (sectionId: string, content: Partial<SectionContent>) => {
      pushSnapshot(sections);
      updateSection(sectionId, content);
    },
    [sections, pushSnapshot, updateSection]
  );

  const handleAddSection = useCallback(
    (section: ResumeSection) => {
      pushSnapshot(sections);
      addSection(section);
    },
    [sections, pushSnapshot, addSection]
  );

  const handleRemoveSection = useCallback(
    (sectionId: string) => {
      pushSnapshot(sections);
      removeSection(sectionId);
    },
    [sections, pushSnapshot, removeSection]
  );

  const handleReorder = useCallback(
    (newSections: ResumeSection[]) => {
      pushSnapshot(sections);
      reorderSections(newSections);
    },
    [sections, pushSnapshot, reorderSections]
  );

  return {
    resume: currentResume,
    sections,
    updateSection: handleUpdateSection,
    addSection: handleAddSection,
    removeSection: handleRemoveSection,
    reorderSections: handleReorder,
    loadResume,
    refreshResume,
    hasLoaded,
  };
}
