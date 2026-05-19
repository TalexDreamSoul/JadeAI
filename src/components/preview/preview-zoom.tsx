'use client';

import { useCallback, useRef, useState } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResumePreview } from '@/components/preview/resume-preview';
import type { Resume } from '@/types/resume';

const A4_WIDTH = 794;
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

interface PreviewZoomProps {
  resume: Resume;
  title: string;
  initialZoom?: number;
  mobileFit?: boolean;
  showToolbar?: boolean;
}

export function PreviewZoom({ resume, title, initialZoom = 80, mobileFit = false, showToolbar = true }: PreviewZoomProps) {
  const [zoom, setZoom] = useState(() => clampZoom(initialZoom));
  const pinchStartRef = useRef<{ distance: number; zoom: number } | null>(null);

  const updateZoom = useCallback((next: number | ((current: number) => number)) => {
    setZoom((current) => clampZoom(typeof next === 'function' ? next(current) : next));
  }, []);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    const isZoomGesture = event.ctrlKey || event.metaKey;
    if (!isZoomGesture) return;

    event.preventDefault();
    updateZoom((current) => current - event.deltaY / 8);
  }, [updateZoom]);

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2) {
      pinchStartRef.current = {
        distance: touchDistance(event.touches),
        zoom,
      };
    }
  }, [zoom]);

  const handleTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2 || !pinchStartRef.current) return;

    event.preventDefault();
    const distance = touchDistance(event.touches);
    const delta = distance - pinchStartRef.current.distance;
    updateZoom(pinchStartRef.current.zoom + delta / PINCH_SENSITIVITY * 100);
  }, [updateZoom]);

  const handleTouchEnd = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length < 2) {
      pinchStartRef.current = null;
    }
  }, []);

  const scale = zoom / 100;

  return (
    <div className="flex h-full min-w-0 flex-col bg-zinc-50 dark:bg-zinc-900">
      {showToolbar && <div className="hidden shrink-0 items-center justify-between border-b bg-white px-4 py-2 md:flex dark:border-zinc-800 dark:bg-background">
        <span className="text-xs font-medium text-zinc-500">{title}</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 cursor-pointer p-0"
            onClick={() => updateZoom((current) => current - ZOOM_STEP)}
            disabled={zoom <= MIN_ZOOM}
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="w-10 text-center text-xs text-zinc-500">{zoom}%</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 cursor-pointer p-0"
            onClick={() => updateZoom((current) => current + ZOOM_STEP)}
            disabled={zoom >= MAX_ZOOM}
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>}

      <div
        className="min-h-0 flex-1 overflow-auto overscroll-contain"
        style={{ touchAction: 'pan-x pan-y' }}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex justify-center p-2 md:p-4">
          <div
            className="bg-white shadow-md"
            style={{
              width: mobileFit ? '100%' : A4_WIDTH,
              maxWidth: A4_WIDTH,
              zoom: mobileFit ? undefined : scale,
            }}
          >
            <ResumePreview resume={resume} />
          </div>
        </div>
      </div>
    </div>
  );
}
