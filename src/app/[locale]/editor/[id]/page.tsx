'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useEditor } from '@/hooks/use-editor';
import { useFingerprint } from '@/hooks/use-fingerprint';
import { useIsMobile } from '@/hooks/use-media-query';
import { EditorToolbar } from '@/components/editor/editor-toolbar';
import { EditorSidebar } from '@/components/editor/editor-sidebar';
import { EditorCanvas } from '@/components/editor/editor-canvas';
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
import { useSettingsStore, useIsLocalOnly } from '@/stores/settings-store';
import { useTourStore, hasCompletedTour } from '@/stores/tour-store';
import { Skeleton } from '@/components/ui/skeleton';
import { SettingsLauncher } from '@/components/layout/settings-launcher';
import { SettingsDialog } from '@/components/settings/settings-dialog';
import { useRouter, usePathname } from '@/i18n/routing';
import { cn } from '@/lib/utils';

const EDITOR_TOUR_STEPS: TourStepConfig[] = [
  { target: 'sidebar', placement: 'right', i18nKey: 'sidebar' },
  { target: 'preview', placement: 'left', i18nKey: 'preview' },
  { target: 'ai-chat', placement: 'top', i18nKey: 'aiChat' },
  { target: 'export', placement: 'bottom', i18nKey: 'export' },
  { target: 'theme', placement: 'bottom', i18nKey: 'theme' },
];

export default function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const pathname = usePathname();
  const { isLoading: fpLoading } = useFingerprint();
  const { resume, sections, updateSection, addSection, removeSection, reorderSections, hasLoaded } = useEditor(id);
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { showThemeEditor, mobileActiveTab } = useEditorStore();
  const { activeModal, openModal, closeModal } = useUIStore();
  const { hydrate, _hydrated, _localOnlyHydrated } = useSettingsStore();
  const localOnly = useIsLocalOnly();
  const startTour = useTourStore((s) => s.startTour);
  const visibleSections = useMemo(
    () => sections.filter((section) => section.visible !== false),
    [sections]
  );
  const printResume = () => {
    const target = `${pathname.replace(/\/$/, '')}/print`;
    window.open(target, '_blank', 'noopener,noreferrer');
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
      <EditorToolbar resumeId={id} onPrint={printResume} />
      <EditorMobileTabBar />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: hidden on mobile, shown on desktop */}
        <div className="hidden md:block">
          <EditorSidebar
            sections={sections}
            onAddSection={addSection}
            onReorderSections={reorderSections}
          />
        </div>

        {/* Canvas: always mounted, hidden on mobile when preview tab active */}
        <div className={cn(
          "min-w-0 flex-1 overflow-hidden md:flex-[4]",
          isMobile && mobileActiveTab !== "edit" && "hidden"
        )}>
          <EditorCanvas
            sections={visibleSections}
            onUpdateSection={updateSection}
            onRemoveSection={removeSection}
            onReorderSections={reorderSections}
          />
        </div>

        {showThemeEditor && <ThemeEditor />}

        {/* Preview: always mounted, hidden on mobile when edit tab active */}
        <div className={cn(
          "min-w-0 flex-1 overflow-hidden md:flex-[6]",
          isMobile && mobileActiveTab !== "preview" && "hidden"
        )}>
          <EditorPreviewTabs resumeId={id} />
        </div>
      </div>

      <SettingsLauncher variant="profile" />

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
            <SheetTitle className="text-sm font-semibold">Sections</SheetTitle>
          </SheetHeader>
          <EditorSidebar
            sections={sections}
            onAddSection={(s) => { addSection(s); setSidebarOpen(false); }}
            onReorderSections={reorderSections}
          />
        </SheetContent>
      </Sheet>

      <AIChatBubble resumeId={id} />
      <SettingsDialog />
      <JdAnalysisDialog
        open={activeModal === 'jd-analysis'}
        onOpenChange={(open) => open ? openModal('jd-analysis') : closeModal()}
        resumeId={id}
      />
      <TranslateDialog
        open={activeModal === 'translate'}
        onOpenChange={(open) => open ? openModal('translate') : closeModal()}
        resumeId={id}
      />
      <ExportDialog
        open={activeModal === 'export'}
        onOpenChange={(open) => open ? openModal('export') : closeModal()}
        resumeId={id}
      />
      <ImportDialog
        open={activeModal === 'import'}
        onOpenChange={(open) => open ? openModal('import') : closeModal()}
        resumeId={id}
      />
      <ShareDialog
        open={activeModal === 'share'}
        onOpenChange={(open) => open ? openModal('share') : closeModal()}
        resumeId={id}
      />
      <CoverLetterDialog
        open={activeModal === 'cover-letter'}
        onOpenChange={(open) => open ? openModal('cover-letter') : closeModal()}
        resumeId={id}
      />
      <GrammarCheckDialog
        open={activeModal === 'grammar-check'}
        onOpenChange={(open) => open ? openModal('grammar-check') : closeModal()}
        resumeId={id}
      />
      <AIReviewDialog
        open={activeModal === 'ai-review'}
        onOpenChange={(open) => open ? openModal('ai-review') : closeModal()}
        resumeId={id}
      />
      <TourOverlay tourId="editor" steps={EDITOR_TOUR_STEPS} />
    </div>
  );
}
