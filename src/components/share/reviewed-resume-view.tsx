'use client';

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare, ZoomIn, ZoomOut } from 'lucide-react';
import { ResumePreview } from '@/components/preview/resume-preview';
import { Button } from '@/components/ui/button';
import type { Resume } from '@/types/resume';

const MIN_ZOOM = 30;
const MAX_ZOOM = 200;
const ZOOM_STEP = 10;
const PINCH_SENSITIVITY = 120;

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value)));
}

function touchDistance(touches: React.TouchList | TouchList) {
  if (touches.length < 2) return 0;
  const [a, b] = [touches[0], touches[1]];
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

export interface ReviewHighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface ReviewAnchorForPreview {
  x?: number;
  y?: number;
  top?: number;
  left?: number;
  width?: number;
  height?: number;
  rects?: ReviewHighlightRect[];
}

export interface ReviewCommentForPreview {
  id: string;
  authorName?: string | null;
  selectedText?: string | null;
  content: string;
  status?: string | null;
  createdAt?: string | Date | null;
  anchor?: ReviewAnchorForPreview | null;
  shareLabel?: string | null;
}

export function anchorToRects(anchor?: ReviewAnchorForPreview | null): ReviewHighlightRect[] {
  if (!anchor) return [];
  if (anchor.rects?.length) return anchor.rects;
  if (anchor.top === undefined) return [];
  return [{
    top: Number(anchor.top || 0),
    left: Number(anchor.left || anchor.x || 0),
    width: Number(anchor.width || 120),
    height: Number(anchor.height || 18),
  }];
}

function formatDate(value?: string | Date | null) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function textNodesUnder(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }
  return nodes;
}

function findTextRects(root: HTMLElement, preview: HTMLElement, selectedText: string, scale = 1): ReviewHighlightRect[] {
  const target = normalizeText(selectedText);
  if (!target) return [];

  const nodes = textNodesUnder(root);
  const chunks: Array<{ node: Text; start: number; end: number }> = [];
  let combined = '';
  for (const node of nodes) {
    const raw = node.textContent || '';
    for (let i = 0; i < raw.length; i += 1) {
      const char = raw[i];
      if (/\s/.test(char)) {
        if (!combined.endsWith(' ')) {
          chunks.push({ node, start: i, end: i + 1 });
          combined += ' ';
        }
      } else {
        chunks.push({ node, start: i, end: i + 1 });
        combined += char;
      }
    }
    if (!combined.endsWith(' ')) {
      chunks.push({ node, start: raw.length, end: raw.length });
      combined += ' ';
    }
  }

  const index = combined.indexOf(target);
  if (index < 0) return [];
  const startChunk = chunks[index];
  const endChunk = chunks[Math.min(chunks.length - 1, index + target.length - 1)];
  if (!startChunk || !endChunk) return [];

  const range = document.createRange();
  range.setStart(startChunk.node, startChunk.start);
  range.setEnd(endChunk.node, endChunk.end);
  const previewRect = preview.getBoundingClientRect();
  const rects = Array.from(range.getClientRects())
    .filter((rect) => rect.width > 0 && rect.height > 0)
    .map((rect) => ({
      top: (rect.top - previewRect.top) / scale,
      left: (rect.left - previewRect.left) / scale,
      width: rect.width / scale,
      height: rect.height / scale,
    }));
  range.detach();
  return rects;
}

interface ReviewedResumeViewProps {
  resume: Resume;
  comments: ReviewCommentForPreview[];
  activeCommentId?: string | null;
  onActiveCommentChange?: (id: string | null) => void;
  previewRef?: React.RefObject<HTMLDivElement | null>;
  onResumeMouseUp?: () => void;
  children?: React.ReactNode;
  watermark?: React.ReactNode;
  className?: string;
  enableZoom?: boolean;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
}

export function ReviewedResumeView({
  resume,
  comments,
  activeCommentId,
  onActiveCommentChange,
  previewRef: externalPreviewRef,
  onResumeMouseUp,
  children,
  watermark,
  className,
  enableZoom = false,
  zoom: controlledZoom,
  onZoomChange,
}: ReviewedResumeViewProps) {
  const internalPreviewRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pinchStartRef = useRef<{ distance: number; zoom: number } | null>(null);
  const previewRef = externalPreviewRef || internalPreviewRef;
  const [hoveredCommentId, setHoveredCommentId] = useState<string | null>(null);
  const [liveRectsByCommentId, setLiveRectsByCommentId] = useState<Record<string, ReviewHighlightRect[]>>({});
  const [previewWidth, setPreviewWidth] = useState(0);
  const [internalZoom, setInternalZoom] = useState(100);
  const zoom = clampZoom(controlledZoom ?? internalZoom);
  const scale = zoom / 100;
  const setZoom = useCallback((next: number | ((current: number) => number)) => {
    const nextZoom = clampZoom(typeof next === 'function' ? next(zoom) : next);
    if (controlledZoom === undefined) setInternalZoom(nextZoom);
    onZoomChange?.(nextZoom);
  }, [controlledZoom, onZoomChange, zoom]);
  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (!enableZoom || (!event.ctrlKey && !event.metaKey)) return;

    event.preventDefault();
    setZoom((current) => current - event.deltaY / 8);
  }, [enableZoom, setZoom]);
  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (!enableZoom || event.touches.length !== 2) return;
    pinchStartRef.current = {
      distance: touchDistance(event.touches),
      zoom,
    };
  }, [enableZoom, zoom]);
  const handleTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (!enableZoom || event.touches.length !== 2 || !pinchStartRef.current) return;

    event.preventDefault();
    const distance = touchDistance(event.touches);
    const delta = distance - pinchStartRef.current.distance;
    setZoom(pinchStartRef.current.zoom + delta / PINCH_SENSITIVITY * 100);
  }, [enableZoom, setZoom]);
  const handleTouchEnd = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length < 2) {
      pinchStartRef.current = null;
    }
  }, []);
  const anchoredComments = useMemo(
    () => comments.filter((comment) => comment.anchor?.top !== undefined && comment.status !== 'resolved'),
    [comments]
  );
  const commentUnderlines = useMemo(
    () => anchoredComments.flatMap((comment) => {
      const rects = liveRectsByCommentId[comment.id]?.length
        ? liveRectsByCommentId[comment.id]
        : anchorToRects(comment.anchor);
      return rects.map((rect) => ({ comment, rect }));
    }),
    [anchoredComments, liveRectsByCommentId]
  );

  useLayoutEffect(() => {
    const root = contentRef.current;
    const preview = previewRef.current;
    if (!root || !preview) return;

    const nextPreviewWidth = preview.clientWidth || 0;
    const measured: Record<string, ReviewHighlightRect[]> = {};
    for (const comment of comments) {
      if (!comment.selectedText || comment.status === 'resolved') continue;
      const rects = findTextRects(root, preview, comment.selectedText, scale);
      if (rects.length > 0) measured[comment.id] = rects;
    }
    window.requestAnimationFrame(() => {
      setPreviewWidth(nextPreviewWidth);
      setLiveRectsByCommentId(measured);
    });
  }, [comments, previewRef, resume, scale]);

  return (
    <div className={enableZoom ? `flex h-full min-w-0 flex-col ${className || ''}` : className}>
      {enableZoom && (
        <div className="sticky top-0 z-30 flex shrink-0 items-center justify-end border-b border-zinc-200 bg-white/90 px-3 py-2 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
          <div className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 cursor-pointer p-0"
              onClick={() => setZoom((current) => current - ZOOM_STEP)}
              disabled={zoom <= MIN_ZOOM}
              aria-label="Zoom out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="w-10 text-center text-xs text-zinc-500">{zoom}%</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 cursor-pointer p-0"
              onClick={() => setZoom((current) => current + ZOOM_STEP)}
              disabled={zoom >= MAX_ZOOM}
              aria-label="Zoom in"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
      <div
        className={enableZoom ? 'min-h-0 flex-1 overflow-auto overscroll-contain' : undefined}
        style={enableZoom ? { touchAction: 'pan-x pan-y' } : undefined}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className={enableZoom ? 'flex justify-center p-2 md:p-4' : undefined}>
          <div
            className={enableZoom ? 'relative origin-top bg-white shadow-md' : 'relative'}
            onMouseUp={onResumeMouseUp}
            ref={previewRef}
            style={enableZoom ? { zoom: scale } : undefined}
          >
            <div ref={contentRef} className="relative border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
              <ResumePreview resume={resume} />
              {watermark}
            </div>
            {children}
            {commentUnderlines.map(({ comment, rect }, index) => {
              const active = hoveredCommentId === comment.id || activeCommentId === comment.id;
              return (
                <div
                  key={`comment-underline-${comment.id}-${index}`}
                  className="group absolute z-20 hidden xl:block"
                  style={{
                    top: `${Math.max(0, rect.top)}px`,
                    left: `${Math.max(0, rect.left)}px`,
                    width: `${Math.min(Math.max(12, rect.width), Math.max(12, previewWidth - Math.max(0, rect.left)))}px`,
                    height: `${Math.max(1, rect.height)}px`,
                  }}
                  onMouseEnter={() => setHoveredCommentId(comment.id)}
                  onMouseLeave={() => setHoveredCommentId((current) => current === comment.id ? null : current)}
                >
                  <button
                    type="button"
                    className={`absolute inset-x-0 bottom-0 h-3 border-b-2 text-[0px] transition-colors ${active ? 'border-brand' : 'border-yellow-500/70'}`}
                    onClick={() => onActiveCommentChange?.(comment.id)}
                    aria-label={comment.content}
                  />
                  <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-64 -translate-x-1/2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left text-xs text-zinc-600 shadow-lg group-hover:block dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                    <div className="flex items-center gap-1.5 font-medium text-zinc-900 dark:text-zinc-100">
                      <MessageSquare className="h-3 w-3 text-brand" />
                      {comment.authorName || 'Reviewer'}
                    </div>
                    <div className="mt-0.5 text-zinc-400">{formatDate(comment.createdAt)}</div>
                    {comment.selectedText && (
                      <div className="mt-2 rounded bg-brand-muted/60 px-2 py-1 text-[11px] text-brand line-clamp-2">
                        {comment.selectedText}
                      </div>
                    )}
                    <div className="mt-2 line-clamp-3 whitespace-pre-wrap text-zinc-700 dark:text-zinc-200">{comment.content}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
