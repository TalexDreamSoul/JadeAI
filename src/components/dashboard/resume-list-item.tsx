'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Copy, Loader2, Trash2, MoreVertical, Pencil, RefreshCw } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { getTemplateLabel } from '@/lib/template-labels';
import type { Resume } from '@/types/resume';
import { getResumeAnalysisState } from '@/lib/resume-analysis/status';

interface ResumeListItemProps {
  resume: Resume;
  onDelete: () => void;
  onDuplicate: () => void;
  onRename: (title: string) => void;
  onRetryAnalysis?: (jobId: string) => void;
}

export function ResumeListItem({ resume, onDelete, onDuplicate, onRename, onRetryAnalysis }: ResumeListItemProps) {
  const t = useTranslations();
  const router = useRouter();
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(resume.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const renamingRef = useRef(false);

  const startRenaming = () => {
    renamingRef.current = true;
    setIsRenaming(true);
  };

  useEffect(() => {
    if (isRenaming) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isRenaming]);

  const commitRename = useCallback(() => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== resume.title) {
      onRename(trimmed);
    } else {
      setRenameValue(resume.title);
    }
    setIsRenaming(false);
    renamingRef.current = false;
  }, [renameValue, resume.title, onRename]);

  // Commit rename on any click outside the input (fires before blur)
  useEffect(() => {
    if (!isRenaming) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        commitRename();
      }
    };
    document.addEventListener('mousedown', handleMouseDown, true);
    return () => document.removeEventListener('mousedown', handleMouseDown, true);
  }, [isRenaming, commitRename]);

  // On blur, refocus if still renaming (handles Radix focus stealing)
  const handleBlur = useCallback(() => {
    requestAnimationFrame(() => {
      if (renamingRef.current && inputRef.current) {
        inputRef.current.focus();
      }
    });
  }, []);

  const templateLabel = getTemplateLabel(resume.template, t);
  const analysis = getResumeAnalysisState(resume);
  const isAnalysisActive = !!analysis && ['queued', 'running', 'retrying'].includes(analysis.status);
  const canRetryAnalysis = !!analysis && ['retrying', 'failed'].includes(analysis.status);
  const analysisLabel = analysis?.status === 'failed'
    ? '解析失败'
    : analysis?.status === 'retrying'
      ? '等待重试'
      : analysis
        ? '解析中'
        : templateLabel;

  return (
    <div
      className={`group flex items-center gap-4 rounded-xl border border-zinc-200 bg-white px-4 py-3 transition-all duration-200 dark:border-zinc-700/60 dark:bg-card ${isRenaming || isAnalysisActive ? '' : 'cursor-pointer hover:shadow-md hover:-translate-y-0.5'}`}
      onClick={() => { if (!renamingRef.current && !isAnalysisActive) router.push(`/editor/${resume.id}`); }}
    >
      {/* Title */}
      <div className="min-w-0 flex-1">
        {isRenaming ? (
          <input
            ref={inputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
              if (e.key === 'Escape') { setRenameValue(resume.title); setIsRenaming(false); renamingRef.current = false; }
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full truncate rounded border border-brand bg-white px-1 text-sm font-semibold text-zinc-900 outline-none focus:ring-1 focus:ring-brand dark:bg-zinc-800 dark:text-zinc-100"
          />
        ) : (
          <h3 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {resume.title}
          </h3>
        )}
      </div>

      {/* Template / analysis badge */}
      <Badge variant={analysis?.status === 'failed' ? 'destructive' : isAnalysisActive ? 'outline' : 'secondary'} className="shrink-0 text-[11px] px-1.5 py-0">
        {analysisLabel}
      </Badge>
      {isAnalysisActive && (
        <span className="flex shrink-0 items-center gap-1 text-xs text-zinc-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
          {analysis.progress}% · {analysis.status === 'retrying' ? '等待重试' : '分析中'}
        </span>
      )}
      {analysis?.errorMessage && (
        <span className="hidden max-w-xs truncate text-xs text-red-500 md:inline">{analysis.errorMessage}</span>
      )}

      {/* Last edited */}
      <span className="hidden shrink-0 text-[12px] text-zinc-400 sm:inline dark:text-zinc-500">
        {resume.updatedAt
          ? t('dashboard.lastEdited', {
              date: new Date(resume.updatedAt).toLocaleDateString(),
            })
          : ''}
      </span>

      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={`cursor-pointer rounded-md p-1 transition-opacity hover:bg-zinc-100 dark:hover:bg-zinc-800 ${analysis ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="h-4 w-4 text-zinc-400" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onCloseAutoFocus={(e) => { if (renamingRef.current) e.preventDefault(); }}>
          {canRetryAnalysis && onRetryAnalysis && (
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onRetryAnalysis(analysis.id);
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              重新分析
            </DropdownMenuItem>
          )}
          {!analysis && (
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                startRenaming();
              }}
            >
              <Pencil className="mr-2 h-4 w-4" />
              {t('common.rename')}
            </DropdownMenuItem>
          )}
          {!analysis && (
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              {t('common.duplicate')}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="cursor-pointer text-red-600"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t('common.delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
