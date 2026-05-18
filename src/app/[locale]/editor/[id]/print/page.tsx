'use client';

import { use, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useEditor } from '@/hooks/use-editor';
import { useFingerprint } from '@/hooks/use-fingerprint';
import { ResumePreview } from '@/components/preview/resume-preview';
import { useResumeStore } from '@/stores/resume-store';

export default function EditorPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { isLoading: fpLoading } = useFingerprint();
  const { resume, hasLoaded } = useEditor(id);
  const { sections } = useResumeStore();

  useEffect(() => {
    if (!resume || typeof window === 'undefined') return;
    const timer = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(timer);
  }, [resume]);

  if (fpLoading || (!hasLoaded && !resume)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-64 space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!resume) {
    return <div className="p-8 text-sm text-zinc-500">Resume not found</div>;
  }

  return (
    <main className="min-h-screen bg-zinc-100 p-6 print:bg-white print:p-0">
      <div className="mx-auto w-[210mm] bg-white print:mx-0 print:w-full print:shadow-none">
        <ResumePreview resume={{ ...resume, sections }} />
      </div>
    </main>
  );
}
