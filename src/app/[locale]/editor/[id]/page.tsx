'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useEditor } from '@/hooks/use-editor';
import { useFingerprint } from '@/hooks/use-fingerprint';
import { useIsMobile } from '@/hooks/use-media-query';
import { EditorToolbar } from '@/components/editor/editor-toolbar';
import { EditorSidebar } from '@/components/editor/editor-sidebar';
import { EditorCanvas } from '@/components/editor/editor-canvas';
import { CareerWorkbench, CareerWorkbenchNav, type CareerWorkbenchAiTool, type CareerWorkbenchTab } from '@/components/career-workbench';
import { ThemeEditor } from '@/components/editor/theme-editor';
import { EditorPreviewTabs } from '@/components/editor/editor-preview-tabs';
import { EditorMobileTabBar } from '@/components/editor/editor-mobile-tab-bar';
import { AIChatBubble } from '@/components/ai/ai-chat-bubble';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from '@/components/ui/button';
import { List } from "lucide-react";
import { JdAnalysisDialog } from '@/components/editor/jd-analysis-dialog';
import { TranslateDialog } from '@/components/editor/translate-dialog';
import { ExportDialog } from '@/components/editor/export-dialog';
import { ImportDialog } from '@/components/editor/import-dialog';
import { ShareDialog } from '@/components/editor/share-dialog';
import { CoverLetterDialog } from '@/components/editor/cover-letter-dialog';
import { GrammarCheckDialog } from '@/components/editor/grammar-check-dialog';
import { AIReviewDialog } from '@/components/editor/ai-review-dialog';
import { TourOverlay, type TourStepConfig } from '@/components/tour/tour-overlay';
import { useEditorStore } from '@/stores/editor-store';
import { useUIStore } from '@/stores/ui-store';
import { useResumeStore } from '@/stores/resume-store';
import { useSettingsStore, useIsLocalOnly } from '@/stores/settings-store';
import { useTourStore, hasCompletedTour } from '@/stores/tour-store';
import { takePendingOptimizeMessage } from '@/lib/pending-optimize';
import { Skeleton } from '@/components/ui/skeleton';
import { SettingsDialog } from '@/components/settings/settings-dialog';
import { IdlePrivacyLock } from '@/components/privacy/idle-privacy-lock';
import { useIdlePrivacyLock } from '@/hooks/use-idle-privacy-lock';
import { useRouter, usePathname } from '@/i18n/routing';
import { cn } from '@/lib/utils';

const EDITOR_TOUR_STEPS: TourStepConfig[] = [
  { target: 'sidebar', placement: 'right', i18nKey: 'sidebar' },
  { target: 'preview', placement: 'left', i18nKey: 'preview' },
  { target: 'ai-chat', placement: 'top', i18nKey: 'aiChat' },
  { target: 'export', placement: 'bottom', i18nKey: 'export' },
  { target: 'theme', placement: 'bottom', i18nKey: 'theme' },
];

const EDITOR_IDLE_LOCK_TIMEOUT_MS = 30 * 60 * 1000;

export default function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isLoading: fpLoading } = useFingerprint();
  const { resume, sections, updateSection, addSection, removeSection, reorderSections, refreshResume, hasLoaded } = useEditor(id);
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [workspaceMode, setWorkspaceMode] = useState<'resume' | 'career'>(() => (
    searchParams.get('workspace') === 'career' ? 'career' : 'resume'
  ));
  const [resumeModulesCollapsed, setResumeModulesCollapsed] = useState(() => searchParams.get('modules') === 'collapsed');
  const [careerTab, setCareerTab] = useState<CareerWorkbenchTab>(() => {
    const tab = searchParams.get('careerTab');
    return tab === 'memory' || tab === 'match' || tab === 'knowledge' || tab === 'interview' ? tab : 'match';
  });
  const { showThemeEditor, mobileActiveTab, setPendingAiMessage, setShowAiChat } = useEditorStore();
  const { activeModal, openModal, closeModal } = useUIStore();
  const { hydrate, _hydrated, _localOnlyHydrated } = useSettingsStore();
  const localOnly = useIsLocalOnly();
  const startTour = useTourStore((s) => s.startTour);
  const { locked: privacyLocked, reloadToUnlock } = useIdlePrivacyLock({
    timeoutMs: EDITOR_IDLE_LOCK_TIMEOUT_MS,
    enabled: !!resume,
    onBeforeLock: () => {
      useResumeStore.getState().persistLocalDraft();
    },
    onLock: () => {
      closeModal();
      useResumeStore.getState().reset();
      useEditorStore.getState().reset();
    },
  });
  const visibleSections = useMemo(
    () => sections.filter((section) => section.visible !== false),
    [sections]
  );
  const printResume = () => {
    const target = `${pathname.replace(/\/$/, '')}/print`;
    window.open(target, '_blank', 'noopener,noreferrer');
  };

  const updateEditorQuery = (next: { workspace?: 'resume' | 'career'; careerTab?: CareerWorkbenchTab; modal?: string | null }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next.workspace) {
      if (next.workspace === 'resume') params.delete('workspace');
      else params.set('workspace', next.workspace);
    }
    if (next.careerTab) {
      if (next.careerTab === 'match') params.delete('careerTab');
      else params.set('careerTab', next.careerTab);
    }
    if (next.modal !== undefined) {
      if (next.modal) params.set('modal', next.modal);
      else params.delete('modal');
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  const setResumeModulesState = (collapsed: boolean) => {
    setResumeModulesCollapsed(collapsed);
    const params = new URLSearchParams(searchParams.toString());
    if (collapsed) params.set('modules', 'collapsed');
    else params.delete('modules');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  const handleWorkspaceModeChange = (mode: 'resume' | 'career') => {
    if (mode === 'career') {
      useEditorStore.setState({ showThemeEditor: false });
    }
    setWorkspaceMode(mode);
    updateEditorQuery({ workspace: mode });
  };

  const handleCareerTabChange = (tab: CareerWorkbenchTab) => {
    setCareerTab(tab);
    updateEditorQuery({ workspace: 'career', careerTab: tab });
  };

  const openEditorModal = (modal: string) => {
    openModal(modal as Parameters<typeof openModal>[0]);
    updateEditorQuery({ modal });
  };

  const openCareerAiTool = (tool: CareerWorkbenchAiTool) => {
    openEditorModal(tool);
  };

  const closeEditorModal = () => {
    closeModal();
    updateEditorQuery({ modal: null });
  };

  useEffect(() => {
    if (!_hydrated || (!localOnly && _localOnlyHydrated)) hydrate(localOnly);
  }, [_hydrated, _localOnlyHydrated, hydrate, localOnly]);

  // Catch unhandled promise rejections (e.g. "Failed to find Server Action")
  // to prevent page crash — show toast instead
  useEffect(() => {
    const handler = (e: PromiseRejectionEvent) => {
      const msg = e.reason?.message || String(e.reason || '');
      if (msg.includes('Server Action') || msg.includes('AI_RetryError') || msg.includes('AI_APICallError')) {
        e.preventDefault();
        toast.error('操作失败', {
          description: msg.includes('Server Action')
            ? '页面版本已更新，请刷新页面重试'
            : 'AI 服务暂时不可用，请稍后重试',
        });
      }
    };
    window.addEventListener('unhandledrejection', handler);
    return () => window.removeEventListener('unhandledrejection', handler);
  }, []);

  useEffect(() => {
    if (!resume) return;
    if (hasCompletedTour('editor')) return;
    if (window.innerWidth < 768) return;
    const timer = setTimeout(() => startTour('editor', EDITOR_TOUR_STEPS.length), 1000);
    return () => clearTimeout(timer);
  }, [resume, startTour]);

  useEffect(() => {
    const modal = searchParams.get('modal');
    if (modal) openModal(modal as Parameters<typeof openModal>[0]);
  }, [openModal, searchParams]);

  // Consume a copy-optimize message handed off via pending-optimize.ts (gated
  // on resume.id === id so it runs after useEditor's cleanup for the old id).
  useEffect(() => {
    if (!resume || resume.id !== id) return;
    const message = takePendingOptimizeMessage(id);
    if (message) {
      setPendingAiMessage(message);
      setShowAiChat(true);
    }
  }, [resume, id, setPendingAiMessage, setShowAiChat]);

  if (privacyLocked) {
    return (
      <IdlePrivacyLock
        onReload={reloadToUnlock}
        title="页面已锁定"
        description="由于长时间无操作，为保护简历隐私，当前编辑内容已隐藏。请重新加载页面以重新获取数据。"
        hint="如果有未保存修改，系统已尽力保存到本地草稿，重新加载后会自动恢复。"
        reloadLabel="重新加载"
      />
    );
  }

  if (fpLoading || (!hasLoaded && !resume)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="space-y-4 w-64">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (hasLoaded && !resume) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 px-6 text-center dark:bg-zinc-950">
        <div className="max-w-sm space-y-4 rounded-2xl border bg-white p-6 shadow-sm dark:bg-zinc-900">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">简历未找到</h1>
          <p className="text-sm text-zinc-500">这份简历可能不存在，或当前是未登录的本地模式，无法读取云端简历。</p>
          <Button onClick={() => router.push('/dashboard')} className="cursor-pointer bg-brand hover:bg-brand-hover">
            返回工作台
          </Button>
        </div>
      </div>
    );
  }

  if (!resume) return null;

  return (
    <div className="flex h-screen flex-col">
      <EditorToolbar
        resumeId={id}
        onPrint={printResume}
        workspaceMode={workspaceMode}
        onWorkspaceModeChange={handleWorkspaceModeChange}
        onOpenModal={openEditorModal}
      />
      <EditorMobileTabBar />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: hidden on mobile, shown on desktop */}
        <div className="hidden md:block">
          {workspaceMode === 'resume' ? (
            <EditorSidebar
              sections={sections}
              onAddSection={addSection}
              onReorderSections={reorderSections}
              modulesCollapsed={resumeModulesCollapsed}
              onModulesCollapsedChange={setResumeModulesState}
            />
          ) : (
            <CareerWorkbenchNav activeTab={careerTab} onActiveTabChange={handleCareerTabChange} onOpenAiTool={openCareerAiTool} />
          )}
        </div>

        {/* Canvas: always mounted, hidden on mobile when preview tab active */}
        <div className={cn(
          "min-w-0 overflow-hidden transition-[flex-basis,width] duration-200",
          resumeModulesCollapsed && workspaceMode === 'resume' ? "hidden md:block md:w-0 md:flex-none" : "flex-1 md:flex-[4]",
          isMobile && mobileActiveTab !== "edit" && "hidden"
        )}>
          {resumeModulesCollapsed && workspaceMode === 'resume' ? null : workspaceMode === 'resume' ? (
            <EditorCanvas
              sections={visibleSections}
              onUpdateSection={updateSection}
              onRemoveSection={removeSection}
              onReorderSections={reorderSections}
            />
          ) : (
            <CareerWorkbench
              embedded
              resumeId={id}
              activeTab={careerTab}
              onActiveTabChange={handleCareerTabChange}
              onResumeChanged={refreshResume}
            />
          )}
        </div>

        {showThemeEditor && <ThemeEditor />}

        {/* Preview: always mounted, hidden on mobile when edit tab active */}
        <div className={cn(
          "min-w-0 flex-1 overflow-hidden md:flex-[6]",
          isMobile && mobileActiveTab !== "preview" && "hidden"
        )}>
          <EditorPreviewTabs resumeId={id} readonly={workspaceMode === 'career'} />
        </div>
      </div>

      {/* Mobile sidebar FAB */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed bottom-20 left-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white shadow-lg transition-transform hover:scale-105 active:scale-95 md:hidden"
        aria-label="Open sections"
      >
        <List className="h-5 w-5" />
      </button>

      {/* Mobile sidebar Sheet */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle className="text-sm font-semibold">{workspaceMode === 'resume' ? 'Sections' : '求职工作台'}</SheetTitle>
          </SheetHeader>
          {workspaceMode === 'resume' ? (
            <EditorSidebar
              sections={sections}
              onAddSection={(s) => { addSection(s); setSidebarOpen(false); }}
              onReorderSections={reorderSections}
            />
          ) : (
            <CareerWorkbenchNav
              activeTab={careerTab}
              onActiveTabChange={(tab) => {
                handleCareerTabChange(tab);
                setSidebarOpen(false);
              }}
              onOpenAiTool={(tool) => {
                openCareerAiTool(tool);
                setSidebarOpen(false);
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      <AIChatBubble resumeId={id} />
      <SettingsDialog />
      <JdAnalysisDialog
        open={activeModal === 'jd-analysis'}
        onOpenChange={(open) => open ? openEditorModal('jd-analysis') : closeEditorModal()}
        resumeId={id}
      />
      <TranslateDialog
        open={activeModal === 'translate'}
        onOpenChange={(open) => open ? openEditorModal('translate') : closeEditorModal()}
        resumeId={id}
      />
      <ExportDialog
        open={activeModal === 'export'}
        onOpenChange={(open) => open ? openEditorModal('export') : closeEditorModal()}
        resumeId={id}
      />
      <ImportDialog
        open={activeModal === 'import'}
        onOpenChange={(open) => open ? openEditorModal('import') : closeEditorModal()}
        resumeId={id}
      />
      <ShareDialog
        open={activeModal === 'share'}
        onOpenChange={(open) => open ? openEditorModal('share') : closeEditorModal()}
        resumeId={id}
      />
      <CoverLetterDialog
        open={activeModal === 'cover-letter'}
        onOpenChange={(open) => open ? openEditorModal('cover-letter') : closeEditorModal()}
        resumeId={id}
      />
      <GrammarCheckDialog
        open={activeModal === 'grammar-check'}
        onOpenChange={(open) => open ? openEditorModal('grammar-check') : closeEditorModal()}
        resumeId={id}
      />
      <AIReviewDialog
        open={activeModal === 'ai-review'}
        onOpenChange={(open) => open ? openEditorModal('ai-review') : closeEditorModal()}
        resumeId={id}
      />
      <TourOverlay tourId="editor" steps={EDITOR_TOUR_STEPS} />
    </div>
  );
}
