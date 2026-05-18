'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { PreviewZoom } from '@/components/preview/preview-zoom';
import { useResumeStore } from '@/stores/resume-store';
import { useIsMobile } from '@/hooks/use-media-query';
import type { Resume } from '@/types/resume';

export function EditorPreviewPanel() {
  const t = useTranslations('editor.toolbar');
  const { currentResume, sections } = useResumeStore();
  const isMobile = useIsMobile();

  const liveResume = useMemo<Resume | null>(() => {
    if (!currentResume) return null;
    return { ...currentResume, sections };
  }, [currentResume, sections]);

  if (!liveResume) return null;

  return (
    <PreviewZoom
      resume={liveResume}
      title={t('preview')}
      initialZoom={80}
      mobileFit={isMobile}
    />
  );
}
