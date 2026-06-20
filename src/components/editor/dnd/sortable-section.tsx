'use client';

import { createContext, useContext } from 'react';
import type { DraggableSyntheticListeners } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface DragHandleContext {
  attributes: Record<string, any>;
  listeners: DraggableSyntheticListeners;
}

const DragHandleCtx = createContext<DragHandleContext>({
  attributes: {},
  listeners: undefined,
});

export function useDragHandle() {
  return useContext(DragHandleCtx);
}

interface SortableSectionProps {
  id: string;
  children: React.ReactNode;
}

export function SortableSection({ id, children }: SortableSectionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <DragHandleCtx.Provider value={{ attributes, listeners }}>
      <div ref={setNodeRef} style={style} data-section-id={id}>
        {children}
      </div>
    </DragHandleCtx.Provider>
  );
}
