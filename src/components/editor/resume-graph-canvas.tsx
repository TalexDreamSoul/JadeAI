'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Edit3,
  Eye,
  FileText,
  Focus,
  Loader2,
  Lock,
  Maximize2,
  Network,
  RefreshCw,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { EditorCanvas } from '@/components/editor/editor-canvas';
import { ResumePreview } from '@/components/preview/resume-preview';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useFingerprint } from '@/hooks/use-fingerprint';
import { useRouter } from '@/i18n/routing';
import { getLocalResume, getLocalResumes, isLocalResumeId } from '@/lib/local-resumes';
import { normalizeThemeConfig } from '@/lib/theme-config';
import { getAIHeaders } from '@/stores/settings-store';
import { useResumeStore } from '@/stores/resume-store';
import type { Resume, ResumeSection } from '@/types/resume';

const MIN_SCALE = 0.28;
const MAX_SCALE = 1.35;
const SCALE_STEP = 0.12;
const SOURCE_NODE = { x: 100, y: 130, width: 620, height: 820 };
const DERIVED_NODE = { x: 960, y: 130, width: 620, height: 820 };
const GRAPH_BOUNDS = { x: 60, y: 90, width: 1560, height: 900 };

type Viewport = {
  x: number;
  y: number;
  scale: number;
};

type PanState = {
  pointerId: number;
  startX: number;
  startY: number;
  viewportX: number;
  viewportY: number;
};

function clampScale(scale: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

function requestHeaders(includeAI = false) {
  const fingerprint = typeof window !== 'undefined'
    ? localStorage.getItem('touchresume_fingerprint')
    : null;
  return {
    'Content-Type': 'application/json',
    ...(fingerprint ? { 'x-fingerprint': fingerprint } : {}),
    ...(includeAI ? getAIHeaders() : {}),
  };
}

function normalizeSection(section: ResumeSection): ResumeSection {
  return {
    ...section,
    createdAt: new Date(section.createdAt),
    updatedAt: new Date(section.updatedAt),
  };
}

function normalizeResume(resume: Resume): Resume {
  return {
    ...resume,
    themeConfig: normalizeThemeConfig(resume.themeConfig),
    sections: (resume.sections || []).map(normalizeSection),
    createdAt: new Date(resume.createdAt),
    updatedAt: new Date(resume.updatedAt),
  };
}

function timestamp(value: Date | string | number) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function isJdDerivedResume(resume: Resume) {
  return !!resume.jobDescription?.trim()
    || !!resume.targetCompany?.trim()
    || !!resume.targetJobTitle?.trim()
    || resume.versionLabel?.startsWith('jd') === true;
}

function belongsToSource(resume: Resume, sourceId: string) {
  return isJdDerivedResume(resume) && resume.id !== sourceId && (
    resume.sourceResumeId === sourceId ||
    resume.baseResumeId === sourceId
  );
}

function ResumeSnapshot({ resume }: { resume: Resume }) {
  return (
    <div className="h-[666px] overflow-hidden bg-zinc-100 dark:bg-zinc-950">
      <div
        className="pointer-events-none origin-top-left select-none bg-white shadow-sm"
        style={{ width: 794, transform: 'scale(0.72)' }}
      >
        <ResumePreview resume={resume} />
      </div>
    </div>
  );
}

export function ResumeGraphCanvas({ resumeId }: { resumeId: string }) {
  const t = useTranslations('resumeGraph');
  const router = useRouter();
  const { isLoading: fingerprintLoading } = useFingerprint();
  const viewportRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<PanState | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ x: 80, y: 70, scale: 0.72 });
  const [sourceResume, setSourceResume] = useState<Resume | null>(null);
  const [derivedResume, setDerivedResume] = useState<Resume | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [jdDialogOpen, setJdDialogOpen] = useState(false);
  const [isTailoring, setIsTailoring] = useState(false);
  const [isEditingSource, setIsEditingSource] = useState(false);
  const [sourceEditedSinceTailor, setSourceEditedSinceTailor] = useState(false);
  const [jobDescription, setJobDescription] = useState('');
  const [targetCompany, setTargetCompany] = useState('');
  const [targetJobTitle, setTargetJobTitle] = useState('');
  const storedSourceResume = useResumeStore((state) => state.currentResume);
  const storedSourceSections = useResumeStore((state) => state.sections);
  const sourceIsDirty = useResumeStore((state) => state.isDirty);
  const sourceIsSaving = useResumeStore((state) => state.isSaving);
  const updateSourceSection = useResumeStore((state) => state.updateSection);
  const removeSourceSection = useResumeStore((state) => state.removeSection);
  const reorderSourceSections = useResumeStore((state) => state.reorderSections);

  const activeSourceResume = useMemo(() => {
    if (!sourceResume) return null;
    return storedSourceResume?.id === sourceResume.id
      ? { ...storedSourceResume, sections: storedSourceSections }
      : sourceResume;
  }, [sourceResume, storedSourceResume, storedSourceSections]);
  const isLocalResume = !!activeSourceResume && isLocalResumeId(activeSourceResume.id);
  const sourceChanged = useMemo(() => (
    !!activeSourceResume && !!derivedResume && (
      sourceEditedSinceTailor || timestamp(activeSourceResume.updatedAt) > timestamp(derivedResume.updatedAt)
    )
  ), [activeSourceResume, derivedResume, sourceEditedSinceTailor]);

  const fitView = useCallback(() => {
    const element = viewportRef.current;
    if (!element) return;
    const padding = 48;
    const scale = clampScale(Math.min(
      (element.clientWidth - padding * 2) / GRAPH_BOUNDS.width,
      (element.clientHeight - padding * 2) / GRAPH_BOUNDS.height,
      0.9
    ));
    setViewport({
      scale,
      x: (element.clientWidth - GRAPH_BOUNDS.width * scale) / 2 - GRAPH_BOUNDS.x * scale,
      y: (element.clientHeight - GRAPH_BOUNDS.height * scale) / 2 - GRAPH_BOUNDS.y * scale,
    });
  }, []);

  const activateSourceResume = useCallback((resume: Resume) => {
    const normalized = normalizeResume(resume);
    useResumeStore.getState().setResume(normalized);
    setSourceResume(normalized);
    setSourceEditedSinceTailor(useResumeStore.getState().isDirty);
    setIsEditingSource(false);
  }, []);

  const loadGraph = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      if (isLocalResumeId(resumeId)) {
        const current = getLocalResume(resumeId);
        if (!current) throw new Error(t('notFound'));
        const all = getLocalResumes();
        const sourceId = isJdDerivedResume(current)
          ? current.baseResumeId || current.sourceResumeId || current.id
          : current.id;
        const source = getLocalResume(sourceId) || current;
        const candidates = all
          .filter((item) => belongsToSource(item, source.id))
          .sort((a, b) => timestamp(b.updatedAt) - timestamp(a.updatedAt));
        const selectedDerived = current.id !== source.id ? current : candidates[0] || null;
        activateSourceResume(source);
        setDerivedResume(selectedDerived ? normalizeResume(selectedDerived) : null);
        setJobDescription(selectedDerived?.jobDescription || '');
        setTargetCompany(selectedDerived?.targetCompany || '');
        setTargetJobTitle(selectedDerived?.targetJobTitle || '');
        return;
      }

      const [currentResponse, listResponse] = await Promise.all([
        fetch(`/api/resume/${resumeId}`, { headers: requestHeaders() }),
        fetch('/api/resume', { headers: requestHeaders() }),
      ]);
      if (!currentResponse.ok) throw new Error(t('notFound'));
      if (!listResponse.ok) throw new Error(t('loadFailed'));

      const current = normalizeResume(await currentResponse.json());
      const list = await listResponse.json() as Resume[];
      const sourceId = isJdDerivedResume(current)
        ? current.baseResumeId || current.sourceResumeId || current.id
        : current.id;
      let source = current;
      if (sourceId !== current.id) {
        const sourceResponse = await fetch(`/api/resume/${sourceId}`, { headers: requestHeaders() });
        if (sourceResponse.ok) source = normalizeResume(await sourceResponse.json());
      }

      const candidates = list
        .filter((item) => belongsToSource(item, source.id))
        .sort((a, b) => timestamp(b.updatedAt) - timestamp(a.updatedAt));
      const selectedMeta = current.id !== source.id && belongsToSource(current, source.id)
        ? current
        : candidates[0] || null;
      let selectedDerived: Resume | null = null;
      if (selectedMeta) {
        if (selectedMeta.id === current.id) {
          selectedDerived = current;
        } else {
          const derivedResponse = await fetch(`/api/resume/${selectedMeta.id}`, { headers: requestHeaders() });
          if (derivedResponse.ok) selectedDerived = normalizeResume(await derivedResponse.json());
        }
      }

      activateSourceResume(source);
      setDerivedResume(selectedDerived);
      setJobDescription(selectedDerived?.jobDescription || '');
      setTargetCompany(selectedDerived?.targetCompany || '');
      setTargetJobTitle(selectedDerived?.targetJobTitle || '');
    } catch (loadError) {
      console.error('Failed to load resume graph:', loadError);
      setError(loadError instanceof Error ? loadError.message : t('loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [activateSourceResume, resumeId, t]);

  useEffect(() => {
    if (fingerprintLoading) return;
    void loadGraph();
  }, [fingerprintLoading, loadGraph]);

  useEffect(() => {
    if (sourceIsDirty) setSourceEditedSinceTailor(true);
  }, [sourceIsDirty]);

  useEffect(() => () => {
    const store = useResumeStore.getState();
    store.persistLocalDraft();
    store.reset();
  }, []);

  useEffect(() => {
    if (!isLoading && !error) {
      const frame = requestAnimationFrame(fitView);
      return () => cancelAnimationFrame(frame);
    }
  }, [error, fitView, isLoading]);

  const zoomAtCenter = useCallback((delta: number) => {
    const element = viewportRef.current;
    if (!element) return;
    setViewport((current) => {
      const nextScale = clampScale(current.scale + delta);
      const centerX = element.clientWidth / 2;
      const centerY = element.clientHeight / 2;
      const worldX = (centerX - current.x) / current.scale;
      const worldY = (centerY - current.y) / current.scale;
      return {
        scale: nextScale,
        x: centerX - worldX * nextScale,
        y: centerY - worldY * nextScale,
      };
    });
  }, []);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('[data-source-editor]') && !event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const element = viewportRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;
    setViewport((current) => {
      const nextScale = clampScale(current.scale * Math.exp(-event.deltaY * 0.0012));
      const worldX = (cursorX - current.x) / current.scale;
      const worldY = (cursorY - current.y) / current.scale;
      return {
        scale: nextScale,
        x: cursorX - worldX * nextScale,
        y: cursorY - worldY * nextScale,
      };
    });
  }, []);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('[data-graph-node], [data-graph-control]')) return;
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      viewportX: viewport.x,
      viewportY: viewport.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [viewport.x, viewport.y]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    setViewport((current) => ({
      ...current,
      x: pan.viewportX + event.clientX - pan.startX,
      y: pan.viewportY + event.clientY - pan.startY,
    }));
  }, []);

  const finishPan = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (panRef.current?.pointerId !== event.pointerId) return;
    panRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const handleTailor = async () => {
    if (!activeSourceResume || !jobDescription.trim() || isLocalResume) return;
    setIsTailoring(true);
    try {
      const sourceSaved = await useResumeStore.getState().save();
      if (!sourceSaved) throw new Error(t('sourceSaveFailed'));
      const response = await fetch(`/api/resume/${activeSourceResume.id}/derive`, {
        method: 'POST',
        headers: requestHeaders(true),
        body: JSON.stringify({
          derivedResumeId: derivedResume?.id,
          targetCompany,
          targetJobTitle,
          jobDescription,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || t('tailorFailed'));
      setDerivedResume(normalizeResume(data));
      setSourceEditedSinceTailor(false);
      setJdDialogOpen(false);
      toast.success(derivedResume ? t('refreshDone') : t('createDone'));
    } catch (tailorError) {
      console.error('Failed to tailor derived resume:', tailorError);
      toast.error(tailorError instanceof Error ? tailorError.message : t('tailorFailed'));
    } finally {
      setIsTailoring(false);
    }
  };

  if (isLoading || fingerprintLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-100 dark:bg-zinc-950">
        <div className="flex items-center gap-3 text-sm text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin text-brand" />
          {t('loading')}
        </div>
      </div>
    );
  }

  if (error || !activeSourceResume) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-100 px-6 dark:bg-zinc-950">
        <div className="max-w-sm rounded-2xl border bg-white p-6 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <Network className="mx-auto h-8 w-8 text-zinc-400" />
          <h1 className="mt-3 font-semibold">{t('loadFailed')}</h1>
          <p className="mt-2 text-sm text-zinc-500">{error}</p>
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="outline" onClick={() => router.push('/dashboard')}>{t('back')}</Button>
            <Button onClick={() => void loadGraph()}>{t('retry')}</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="z-30 flex h-16 shrink-0 items-center justify-between border-b border-zinc-200 bg-white/95 px-3 backdrop-blur md:px-5 dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')} aria-label={t('back')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-muted text-brand">
            <Network className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-semibold md:text-base">{t('title')}</h1>
              <Badge variant="secondary" className="hidden sm:inline-flex">{t('infiniteCanvas')}</Badge>
            </div>
            <p className="hidden truncate text-xs text-zinc-500 sm:block">{t('subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {sourceChanged && (
            <Badge variant="outline" className="hidden border-amber-300 bg-amber-50 text-amber-700 md:inline-flex dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
              {t('outdated')}
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => setIsEditingSource((current) => !current)}>
            {isEditingSource ? <Eye className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
            <span className="hidden sm:inline">{isEditingSource ? t('previewSource') : t('inlineEdit')}</span>
          </Button>
          <Button size="sm" className="bg-brand hover:bg-brand-hover" onClick={() => setJdDialogOpen(true)}>
            {derivedResume ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            <span className="hidden sm:inline">{derivedResume ? t('refresh') : t('create')}</span>
          </Button>
        </div>
      </header>

      <div
        ref={viewportRef}
        className={`relative min-h-0 flex-1 touch-none overflow-hidden ${panRef.current ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{
          backgroundImage: 'radial-gradient(circle, rgb(161 161 170 / 0.48) 1px, transparent 1px)',
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
          backgroundSize: `${24 * viewport.scale}px ${24 * viewport.scale}px`,
        }}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPan}
        onPointerCancel={finishPan}
        onDoubleClick={fitView}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})` }}
        >
          <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width="1700" height="1000" aria-hidden="true">
            <defs>
              <marker id="resume-graph-arrow" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
                <path d="M 0 0 L 12 6 L 0 12 z" fill="rgb(99 102 241)" />
              </marker>
            </defs>
            <path
              d={`M ${SOURCE_NODE.x + SOURCE_NODE.width} ${SOURCE_NODE.y + 335} C ${SOURCE_NODE.x + SOURCE_NODE.width + 120} ${SOURCE_NODE.y + 335}, ${DERIVED_NODE.x - 120} ${DERIVED_NODE.y + 335}, ${DERIVED_NODE.x} ${DERIVED_NODE.y + 335}`}
              fill="none"
              stroke="rgb(99 102 241)"
              strokeWidth="4"
              strokeDasharray={sourceChanged ? '10 8' : undefined}
              markerEnd="url(#resume-graph-arrow)"
            />
          </svg>

          <div
            className="absolute flex items-center gap-2 whitespace-nowrap rounded-full border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-600 shadow-sm dark:border-indigo-900 dark:bg-zinc-900 dark:text-indigo-300"
            style={{ left: 765, top: 435 }}
          >
            <Sparkles className="h-4 w-4" />
            {sourceChanged ? t('resyncRelation') : t('relation')}
          </div>

          <section
            data-graph-node
            className="absolute overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_18px_50px_-22px_rgba(0,0,0,0.35)] dark:border-zinc-700 dark:bg-zinc-900"
            style={{ left: SOURCE_NODE.x, top: SOURCE_NODE.y, width: SOURCE_NODE.width, height: SOURCE_NODE.height }}
            onDoubleClick={(event) => event.stopPropagation()}
          >
            <div className="flex h-[94px] items-center justify-between border-b border-zinc-200 px-5 dark:border-zinc-800">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge className="bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">{t('sourceBadge')}</Badge>
                  <span className="text-xs text-zinc-400">{t('editable')}</span>
                </div>
                <h2 className="mt-2 truncate text-lg font-semibold">{activeSourceResume.title}</h2>
              </div>
              <Button variant="outline" onClick={() => setIsEditingSource((current) => !current)}>
                {isEditingSource ? <Eye className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
                {isEditingSource ? t('previewSource') : t('inlineEdit')}
              </Button>
            </div>
            {isEditingSource ? (
              <div data-source-editor className="h-[666px] overflow-hidden">
                <EditorCanvas
                  sections={activeSourceResume.sections.filter((section) => section.visible !== false)}
                  onUpdateSection={updateSourceSection}
                  onRemoveSection={removeSourceSection}
                  onReorderSections={reorderSourceSections}
                />
              </div>
            ) : (
              <div
                role="button"
                tabIndex={0}
                className="group relative cursor-text outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
                onClick={() => setIsEditingSource(true)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') setIsEditingSource(true);
                }}
              >
                <ResumeSnapshot resume={activeSourceResume} />
                <span className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-zinc-200 bg-white/95 px-4 py-2 text-sm font-medium text-zinc-700 opacity-0 shadow-lg backdrop-blur transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-200">
                  <Edit3 className="h-4 w-4 text-brand" />
                  {t('clickToEdit')}
                </span>
              </div>
            )}
            <div className="flex h-[60px] items-center justify-between border-t border-zinc-200 px-5 text-sm dark:border-zinc-800">
              <span className="text-zinc-500">{isEditingSource ? t('inlineEditHint') : t('sourceHint')}</span>
              <span className="text-xs text-zinc-400">
                {sourceIsSaving ? t('saving') : sourceIsDirty ? t('waitingToSave') : t('saved')}
              </span>
            </div>
          </section>

          <section
            data-graph-node
            className="absolute overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-[0_18px_50px_-22px_rgba(79,70,229,0.4)] dark:border-indigo-900 dark:bg-zinc-900"
            style={{ left: DERIVED_NODE.x, top: DERIVED_NODE.y, width: DERIVED_NODE.width, height: DERIVED_NODE.height }}
          >
            {derivedResume ? (
              <>
                <div className="flex h-[94px] items-center justify-between border-b border-indigo-100 bg-indigo-50/50 px-5 dark:border-indigo-950 dark:bg-indigo-950/20">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-indigo-600 text-white">{t('derivedBadge')}</Badge>
                      <span className="flex items-center gap-1 text-xs text-zinc-400"><Lock className="h-3 w-3" />{t('readOnly')}</span>
                      {sourceChanged && <Badge variant="outline" className="border-amber-300 text-amber-700 dark:border-amber-900 dark:text-amber-300">{t('outdatedShort')}</Badge>}
                    </div>
                    <h2 className="mt-2 truncate text-lg font-semibold">{derivedResume.title}</h2>
                  </div>
                  <Button variant="outline" onClick={() => setJdDialogOpen(true)}>
                    <RefreshCw className="h-4 w-4" />
                    {t('refresh')}
                  </Button>
                </div>
                <ResumeSnapshot resume={derivedResume} />
                <div className="flex h-[60px] items-center justify-between gap-4 border-t border-indigo-100 px-5 dark:border-indigo-950">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{derivedResume.targetJobTitle || derivedResume.targetCompany || t('targetRole')}</p>
                    <p className="truncate text-xs text-zinc-400">{derivedResume.jobDescription || t('noJd')}</p>
                  </div>
                  <span className="shrink-0 text-xs text-zinc-400">{new Date(derivedResume.updatedAt).toLocaleString()}</span>
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center px-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300">
                  <FileText className="h-8 w-8" />
                </div>
                <Badge className="mt-5 bg-indigo-600 text-white">{t('derivedBadge')}</Badge>
                <h2 className="mt-3 text-xl font-semibold">{t('emptyTitle')}</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">{t('emptyDescription')}</p>
                <Button className="mt-6 bg-brand hover:bg-brand-hover" onClick={() => setJdDialogOpen(true)}>
                  <Sparkles className="h-4 w-4" />
                  {t('provideJd')}
                </Button>
              </div>
            )}
          </section>
        </div>

        <div data-graph-control className="absolute bottom-5 right-5 z-20 flex items-center gap-1 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          <Button variant="ghost" size="icon-sm" onClick={() => zoomAtCenter(-SCALE_STEP)} disabled={viewport.scale <= MIN_SCALE} aria-label={t('zoomOut')}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="w-12 text-center text-xs tabular-nums text-zinc-500">{Math.round(viewport.scale * 100)}%</span>
          <Button variant="ghost" size="icon-sm" onClick={() => zoomAtCenter(SCALE_STEP)} disabled={viewport.scale >= MAX_SCALE} aria-label={t('zoomIn')}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <div className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />
          <Button variant="ghost" size="icon-sm" onClick={fitView} aria-label={t('fitView')}>
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>

        <div data-graph-control className="absolute bottom-5 left-5 z-20 hidden items-center gap-2 rounded-xl border border-zinc-200 bg-white/95 px-3 py-2 text-xs text-zinc-500 shadow-sm backdrop-blur sm:flex dark:border-zinc-800 dark:bg-zinc-900/95">
          <Focus className="h-4 w-4" />
          {t('canvasHint')}
        </div>
      </div>

      <Dialog open={jdDialogOpen} onOpenChange={(open) => !isTailoring && setJdDialogOpen(open)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{derivedResume ? t('refreshDialogTitle') : t('createDialogTitle')}</DialogTitle>
            <DialogDescription>{t('dialogDescription')}</DialogDescription>
          </DialogHeader>
          {isLocalResume && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              {t('localOnlyWarning')}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="resume-graph-company">{t('company')}</Label>
              <Input id="resume-graph-company" value={targetCompany} onChange={(event) => setTargetCompany(event.target.value)} placeholder={t('companyPlaceholder')} disabled={isTailoring} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resume-graph-role">{t('role')}</Label>
              <Input id="resume-graph-role" value={targetJobTitle} onChange={(event) => setTargetJobTitle(event.target.value)} placeholder={t('rolePlaceholder')} disabled={isTailoring} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="resume-graph-jd">{t('jobDescription')}</Label>
              <Textarea
                id="resume-graph-jd"
                value={jobDescription}
                onChange={(event) => setJobDescription(event.target.value)}
                placeholder={t('jobDescriptionPlaceholder')}
                className="min-h-56 resize-none"
                disabled={isTailoring}
              />
              <p className="text-xs text-zinc-500">{t('jdHint')}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJdDialogOpen(false)} disabled={isTailoring}>{t('cancel')}</Button>
            <Button
              className="bg-brand hover:bg-brand-hover"
              onClick={() => void handleTailor()}
              disabled={isTailoring || isLocalResume || !jobDescription.trim()}
            >
              {isTailoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {isTailoring ? t('tailoring') : derivedResume ? t('refreshAction') : t('createAction')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
