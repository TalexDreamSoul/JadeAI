'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import {
  ArrowLeft,
  ChevronDown,
  Cloud,
  CloudOff,
  Download,
  FileText,
  GitBranch,
  Languages,
  MoreHorizontal,
  Palette,
  Pencil,
  Printer,
  Redo2,
  Save,
  Share2,
  SpellCheck,
  Undo2,
  Upload,
  WandSparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RenameTitleDialog } from '@/components/editor/rename-title-dialog';
import { useEditorStore } from '@/stores/editor-store';
import { useResumeStore } from '@/stores/resume-store';
import { useUIStore } from '@/stores/ui-store';
import { isLocalResumeId } from '@/lib/local-resumes';
import { useIsLocalOnly, useSettingsStore } from '@/stores/settings-store';

interface EditorToolbarProps {
  resumeId: string;
  onPrint?: () => void;
  workspaceMode?: 'resume' | 'career';
  onWorkspaceModeChange?: (mode: 'resume' | 'career') => void;
  onOpenModal?: (modal: 'ai-review' | 'translate' | 'cover-letter' | 'grammar-check' | 'export' | 'import' | 'share') => void;
}

export function EditorToolbar({ resumeId, onPrint, workspaceMode = 'resume', onWorkspaceModeChange, onOpenModal }: EditorToolbarProps) {
  const t = useTranslations('editor.toolbar');
  const router = useRouter();
  const { toggleThemeEditor, showThemeEditor, undo, redo, undoStack, redoStack } = useEditorStore();
  const { isSaving, isDirty, currentResume, reorderSections, save, setTitle, enableCloudSync, disableCloudSync } = useResumeStore();
  const { openModal } = useUIStore();
  const autoSave = useSettingsStore((s) => s.autoSave);
  const localOnly = useIsLocalOnly();
  const [renameOpen, setRenameOpen] = useState(false);
  const isOfflineResume = isLocalResumeId(resumeId) || currentResume?.cloudSyncEnabled === false;
  const cloudDisabled = localOnly || isOfflineResume;
  const aiDisabled = false;
  const cloudActionLabel = isOfflineResume ? t('uploadToCloud') : t('switchToLocalOnly');
  const openToolModal = (modal: Parameters<NonNullable<EditorToolbarProps['onOpenModal']>>[0]) => {
    if (onOpenModal) onOpenModal(modal);
    else openModal(modal);
  };

  const toggleCloudSync = async () => {
    if (!currentResume) return;

    if (cloudDisabled) {
      const ok = await enableCloudSync();
      if (ok) {
        toast.success(t('cloudUploadSuccess'));
        const nextId = useResumeStore.getState().currentResume?.id;
        if (nextId && nextId !== resumeId) router.push(`/editor/${nextId}`);
      } else {
        toast.error(t('cloudUploadFailed'));
      }
      return;
    }

    const confirmed = window.confirm(t('cloudLocalConfirm'));
    if (!confirmed) return;
    const ok = await disableCloudSync();
    if (ok) {
      toast.success(t('cloudLocalSuccess'));
      const nextId = useResumeStore.getState().currentResume?.id;
      if (nextId && nextId !== resumeId) router.push(`/editor/${nextId}`);
    } else {
      toast.error(t('cloudLocalFailed'));
    }
  };

  const saveVersion = async () => {
    await save();
    if (localOnly || isLocalResumeId(resumeId)) return;
    await fetch(`/api/resume/${resumeId}/versions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(typeof window !== 'undefined' && localStorage.getItem('touchresume_fingerprint')
          ? { 'x-fingerprint': localStorage.getItem('touchresume_fingerprint') as string }
          : {}),
      },
      body: JSON.stringify({ label: currentResume?.versionLabel || `v${new Date().toISOString()}` }),
    }).catch(() => null);
  };

  const handleRename = (title: string) => {
    setTitle(title);
  };

  const handleUndo = () => {
    const snapshot = undo();
    if (snapshot) {
      reorderSections(snapshot.sections);
    }
  };

  const handleRedo = () => {
    const snapshot = redo();
    if (snapshot) {
      reorderSections(snapshot.sections);
    }
  };

  const fileMenu = (
    <DropdownMenuContent align="end" className="w-44">
      <DropdownMenuItem onClick={() => openToolModal('export')} className="cursor-pointer">
        <Download className="mr-2 h-4 w-4" />
        {t('exportPdf')}
      </DropdownMenuItem>
      {onPrint && (
        <DropdownMenuItem onClick={onPrint} className="cursor-pointer">
          <Printer className="mr-2 h-4 w-4" />
          {t('print')}
        </DropdownMenuItem>
      )}
      <DropdownMenuItem onClick={() => openToolModal('import')} className="cursor-pointer">
        <Upload className="mr-2 h-4 w-4" />
        {t('import')}
      </DropdownMenuItem>
      <DropdownMenuItem disabled={cloudDisabled} onClick={() => openToolModal('share')} className="cursor-pointer">
        <Share2 className="mr-2 h-4 w-4" />
        {t('share')}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        disabled={localOnly && !isLocalResumeId(resumeId)}
        onClick={toggleCloudSync}
        className="cursor-pointer"
      >
        {isOfflineResume ? <Cloud className="mr-2 h-4 w-4" /> : <CloudOff className="mr-2 h-4 w-4" />}
        {cloudActionLabel}
      </DropdownMenuItem>
      <DropdownMenuItem disabled={cloudDisabled} onClick={saveVersion} className="cursor-pointer">
        <GitBranch className="mr-2 h-4 w-4" />
        {t('saveVersion')}
      </DropdownMenuItem>
    </DropdownMenuContent>
  );

  const aiMenu = (
    <DropdownMenuContent align="end" className="w-44">
      <DropdownMenuItem disabled={aiDisabled} onClick={() => openToolModal('ai-review')} className="cursor-pointer">
        <WandSparkles className="mr-2 h-4 w-4" />
        {t('aiReview')}
      </DropdownMenuItem>
      <DropdownMenuItem disabled={aiDisabled} onClick={() => openToolModal('translate')} className="cursor-pointer">
        <Languages className="mr-2 h-4 w-4" />
        {t('translate')}
      </DropdownMenuItem>
      <DropdownMenuItem disabled={aiDisabled} onClick={() => openToolModal('cover-letter')} className="cursor-pointer">
        <FileText className="mr-2 h-4 w-4" />
        {t('coverLetter')}
      </DropdownMenuItem>
      <DropdownMenuItem disabled={aiDisabled} onClick={() => openToolModal('grammar-check')} className="cursor-pointer">
        <SpellCheck className="mr-2 h-4 w-4" />
        {t('grammarCheck')}
      </DropdownMenuItem>
    </DropdownMenuContent>
  );

  return (
    <div className="flex h-12 items-center justify-between gap-2 border-b bg-white px-2 sm:px-3 dark:bg-background dark:border-zinc-800">
      <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/dashboard')}
          className="h-8 w-8 shrink-0 cursor-pointer text-zinc-600"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="hidden h-6 sm:block" />
        <button
          type="button"
          onClick={() => setRenameOpen(true)}
          className="group flex min-w-0 max-w-[10rem] cursor-pointer items-center gap-1 rounded px-1 py-1 text-left hover:bg-zinc-100 sm:max-w-56 dark:hover:bg-zinc-800"
          title={t('renameTitle')}
        >
          <span className="min-w-0 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {currentResume?.title || ''}
          </span>
          <Pencil className="h-3.5 w-3.5 shrink-0 text-zinc-400 opacity-70 group-hover:opacity-100" />
        </button>
        <span className="hidden text-xs text-zinc-400 sm:inline">
          {isSaving ? t('saving') : isDirty ? (autoSave ? '' : t('unsaved')) : t('autoSaved')}
        </span>
        {!cloudDisabled && !autoSave && isDirty && !isSaving && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => save()}
            className="cursor-pointer gap-1 text-brand hover:text-brand hover:bg-brand-muted"
          >
            <Save className="h-3.5 w-3.5" />
            <span className="text-xs">{t('save')}</span>
          </Button>
        )}
      </div>

      {onWorkspaceModeChange && (
        <div className="hidden shrink-0 rounded-lg border bg-zinc-50 p-1 dark:bg-zinc-900 lg:flex">
          <button
            type="button"
            onClick={() => onWorkspaceModeChange('resume')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${workspaceMode === 'resume' ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-zinc-50' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
          >
            {t('resumeWorkspace')}
          </button>
          <button
            type="button"
            onClick={() => onWorkspaceModeChange('career')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${workspaceMode === 'career' ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-zinc-50' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
          >
            {t('careerWorkspace')}
          </button>
        </div>
      )}

      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleUndo}
          disabled={undoStack.length === 0}
          className="h-8 w-8 cursor-pointer"
          title={t('undo')}
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRedo}
          disabled={redoStack.length === 0}
          className="h-8 w-8 cursor-pointer"
          title={t('redo')}
        >
          <Redo2 className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="hidden h-6 sm:block" />

        <div className="hidden items-center gap-1 md:flex">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button data-tour="export" variant="ghost" size="sm" className="cursor-pointer gap-1.5">
                <Download className="h-4 w-4" />
                <span className="text-xs">{t('fileActions')}</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            {fileMenu}
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="cursor-pointer gap-1.5">
                <WandSparkles className="h-4 w-4" />
                <span className="text-xs">{t('aiActions')}</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            {aiMenu}
          </DropdownMenu>
        </div>

        <div className="md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => openToolModal('export')} className="cursor-pointer">
                <Download className="mr-2 h-4 w-4" />
                {t('exportPdf')}
              </DropdownMenuItem>
              {onPrint && (
                <DropdownMenuItem onClick={onPrint} className="cursor-pointer">
                  <Printer className="mr-2 h-4 w-4" />
                  {t('print')}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => openToolModal('import')} className="cursor-pointer">
                <Upload className="mr-2 h-4 w-4" />
                {t('import')}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={cloudDisabled} onClick={() => openToolModal('share')} className="cursor-pointer">
                <Share2 className="mr-2 h-4 w-4" />
                {t('share')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={aiDisabled} onClick={() => openToolModal('ai-review')} className="cursor-pointer">
                <WandSparkles className="mr-2 h-4 w-4" />
                {t('aiReview')}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={aiDisabled} onClick={() => openToolModal('translate')} className="cursor-pointer">
                <Languages className="mr-2 h-4 w-4" />
                {t('translate')}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={aiDisabled} onClick={() => openToolModal('cover-letter')} className="cursor-pointer">
                <FileText className="mr-2 h-4 w-4" />
                {t('coverLetter')}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={aiDisabled} onClick={() => openToolModal('grammar-check')} className="cursor-pointer">
                <SpellCheck className="mr-2 h-4 w-4" />
                {t('grammarCheck')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={localOnly && !isLocalResumeId(resumeId)}
                onClick={toggleCloudSync}
                className="cursor-pointer"
              >
                {isOfflineResume ? <Cloud className="mr-2 h-4 w-4" /> : <CloudOff className="mr-2 h-4 w-4" />}
                {cloudActionLabel}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={cloudDisabled} onClick={saveVersion} className="cursor-pointer">
                <GitBranch className="mr-2 h-4 w-4" />
                {t('saveVersion')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Separator orientation="vertical" className="hidden h-6 sm:block" />
        <Button
          data-tour="theme"
          variant={showThemeEditor ? 'secondary' : 'ghost'}
          size="icon"
          onClick={toggleThemeEditor}
          className="h-8 w-8 cursor-pointer sm:w-auto sm:px-3"
          title={t('theme')}
        >
          <Palette className="h-4 w-4" />
          <span className="ml-1 hidden text-xs sm:inline">{t('theme')}</span>
        </Button>
      </div>

      <RenameTitleDialog
        open={renameOpen}
        title={currentResume?.title || ''}
        onOpenChange={setRenameOpen}
        onSave={handleRename}
      />
    </div>
  );
}
