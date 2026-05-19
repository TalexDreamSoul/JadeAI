'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { GitBranch, MessageSquareText, PencilRuler } from 'lucide-react';
import { useResumeStore } from '@/stores/resume-store';
import { useIsMobile } from '@/hooks/use-media-query';
import { PreviewZoom } from '@/components/preview/preview-zoom';
import { ReviewPreviewPanel, type ReviewOption } from '@/components/editor/review-preview-panel';
import { VersionPreviewPanel, type VersionOption } from '@/components/editor/version-preview-panel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Resume } from '@/types/resume';

type PreviewMode = 'edit' | 'review';
type EditView = 'live' | 'versions';

export function EditorPreviewTabs({ resumeId, readonly = false }: { resumeId: string; readonly?: boolean }) {
  const t = useTranslations('editor.previewTabs');
  const toolbarT = useTranslations('editor.toolbar');
  const { currentResume, sections } = useResumeStore();
  const isMobile = useIsMobile();
  const [mode, setMode] = useState<PreviewMode>('edit');
  const [editView, setEditView] = useState<EditView>('live');
  const [selectedVersionId, setSelectedVersionId] = useState('live');
  const [versionOptions, setVersionOptions] = useState<VersionOption[]>([]);
  const [selectedReviewId, setSelectedReviewId] = useState('all');
  const [reviewOptions, setReviewOptions] = useState<ReviewOption[]>([]);

  const liveResume = useMemo<Resume | null>(() => {
    if (!currentResume) return null;
    return { ...currentResume, sections };
  }, [currentResume, sections]);

  if (!liveResume) return null;

  if (readonly) {
    return (
      <div data-tour="preview" className="flex h-full min-w-0 flex-col border-l bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
        <PreviewZoom resume={liveResume} title={toolbarT('preview')} initialZoom={80} mobileFit={isMobile} showToolbar={false} />
      </div>
    );
  }

  return (
    <div data-tour="preview" className="flex h-full min-w-0 flex-col border-l bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex shrink-0 items-center justify-between border-b bg-white px-3 py-2 dark:border-zinc-800 dark:bg-background">
        <div className="flex items-center gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
          <button
            type="button"
            onClick={() => setMode('edit')}
            className={cn(
              'inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              mode === 'edit'
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-100'
            )}
          >
            <PencilRuler className="h-3.5 w-3.5" />
            {t('editPreview')}
          </button>
          <button
            type="button"
            onClick={() => setMode('review')}
            className={cn(
              'inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              mode === 'review'
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-100'
            )}
          >
            <MessageSquareText className="h-3.5 w-3.5" />
            {t('reviewPreview')}
          </button>
        </div>

        <div className="flex items-center gap-2">
        {mode === 'edit' && (
          <div className="hidden items-center gap-1 rounded-lg bg-zinc-100 p-1 md:flex dark:bg-zinc-800">
            <button
              type="button"
              onClick={() => setEditView('live')}
              className={cn(
                'cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                editView === 'live'
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-100'
              )}
            >
              {toolbarT('preview')}
            </button>
            <button
              type="button"
              onClick={() => setEditView('versions')}
              className={cn(
                'cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                editView === 'versions'
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-100'
              )}
            >
              {t('versions')}
            </button>
          </div>
        )}
        {mode === 'edit' ? (
          <Select
            value={selectedVersionId}
            onValueChange={(value) => {
              setSelectedVersionId(value);
              setEditView(value === 'live' ? 'live' : 'versions');
            }}
          >
            <SelectTrigger size="sm" className="hidden w-[220px] cursor-pointer md:flex">
              <GitBranch className="h-3.5 w-3.5 text-zinc-400" />
              <SelectValue placeholder={t('selectVersion')} />
            </SelectTrigger>
            <SelectContent align="end" className="max-h-80">
              <SelectItem value="live" className="cursor-pointer">{t('current')}</SelectItem>
              {versionOptions.map((version) => (
                <SelectItem key={version.id} value={version.id} className="cursor-pointer">
                  {version.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Select value={selectedReviewId} onValueChange={setSelectedReviewId}>
            <SelectTrigger size="sm" className="hidden w-[240px] cursor-pointer md:flex">
              <MessageSquareText className="h-3.5 w-3.5 text-zinc-400" />
              <SelectValue placeholder={t('selectReview')} />
            </SelectTrigger>
            <SelectContent align="end" className="max-h-80">
              {reviewOptions.length === 0 ? (
                <SelectItem value="all" className="cursor-pointer">{t('allReviews')}</SelectItem>
              ) : reviewOptions.map((option) => (
                <SelectItem key={option.id} value={option.id} className="cursor-pointer">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {mode === 'review' ? (
          <ReviewPreviewPanel
            resumeId={resumeId}
            resume={liveResume}
            selectedReviewId={selectedReviewId}
            onReviewOptionsChange={setReviewOptions}
          />
        ) : editView === 'versions' ? (
          <VersionPreviewPanel
            resumeId={resumeId}
            liveResume={liveResume}
            selectedVersionId={selectedVersionId}
            onSelectedVersionIdChange={setSelectedVersionId}
            onVersionOptionsChange={setVersionOptions}
          />
        ) : (
          <PreviewZoom resume={liveResume} title={toolbarT('preview')} initialZoom={80} mobileFit={isMobile} />
        )}
      </div>
    </div>
  );
}
