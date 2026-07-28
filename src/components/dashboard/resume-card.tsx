'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Copy, Loader2, Trash2, MoreVertical, Share2, Pencil, RefreshCw, Network } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { TemplateThumbnail } from './template-thumbnail';
import { getTemplateLabel } from '@/lib/template-labels';
import type { Resume } from '@/types/resume';
import { getResumeAnalysisState } from '@/lib/resume-analysis/status';

interface ResumeCardProps {
  resume: Resume;
  onDelete: () => void;
  onDuplicate: () => void;
  onRename: (title: string) => void;
  onRetryAnalysis?: (jobId: string) => void;
  onShare?: () => void;
}

export function ResumeCard({ resume, onDelete, onDuplicate, onRename, onRetryAnalysis, onShare }: ResumeCardProps) {
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
  const analysisProgress = Math.max(0, Math.min(100, analysis?.progress || 0));
  const analysisMessage = analysis?.message || (analysis?.status === 'retrying' ? '等待系统自动重试' : '正在分析简历内容');

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border border-zinc-200 bg-white transition-all duration-200 dark:border-zinc-700/60 dark:bg-card ${isRenaming || isAnalysisActive ? '' : 'cursor-pointer hover:shadow-lg hover:-translate-y-0.5'}`}
      onClick={() => { if (!renamingRef.current && !isAnalysisActive) router.push(`/editor/${resume.id}`); }}
    >
      {/* Template preview thumbnail */}
      <div className="relative border-b border-zinc-100 bg-zinc-50 p-2.5 dark:border-zinc-700/40 dark:bg-zinc-800/50">
        <TemplateThumbnail
          template={resume.template}
          className="mx-auto h-[100px] w-[71px] shadow-sm ring-1 ring-zinc-200/60"
        />
        {/* Hover overlay with actions */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-200 group-hover:bg-black/5 dark:group-hover:bg-white/5" />
        {isAnalysisActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/85 text-xs font-medium text-zinc-700 backdrop-blur-sm dark:bg-zinc-900/80 dark:text-zinc-200">
            <Loader2 className="mb-1 h-5 w-5 animate-spin text-brand" />
            <span>{analysis?.status === 'retrying' ? '等待重试' : '解析中'} {analysisProgress}%</span>
            <span className="mt-1 max-w-[140px] truncate text-[11px] text-zinc-500 dark:text-zinc-400">
              {analysisMessage}
            </span>
          </div>
        )}
      </div>

      {/* Info section */}
      <div className="p-2.5">
        <div className="flex items-start justify-between gap-2">
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
            <div className="mt-1.5 flex items-center gap-1.5">
              <Badge variant={analysis?.status === 'failed' ? 'destructive' : isAnalysisActive ? 'outline' : 'secondary'} className="text-[11px] px-1.5 py-0">
                {analysisLabel}
              </Badge>
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                {resume.updatedAt
                  ? t('dashboard.lastEdited', {
                      date: new Date(resume.updatedAt).toLocaleDateString(),
                    })
                  : ''}
              </span>
            </div>
            {isAnalysisActive && (
              <div className="mt-2">
                <div className="h-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-brand transition-all duration-500"
                    style={{ width: `${analysisProgress}%` }}
                  />
                </div>
                <p className="mt-1 truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                  {analysisMessage}
                </p>
              </div>
            )}
          </div>
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
              {!analysis && <DropdownMenuItem
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate();
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                {t('common.duplicate')}
              </DropdownMenuItem>}
              {onShare && !analysis && (
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShare();
                  }}
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  {t('share.title')}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/editor/${resume.id}/graph`);
                }}
              >
                <Network className="mr-2 h-4 w-4" />
                图谱
              </DropdownMenuItem>
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
          {analysis?.errorMessage && (
            <p className="mt-1 line-clamp-2 text-[11px] text-red-500">{analysis.errorMessage}</p>
          )}
        </div>
      </div>
    </div>
  );
}
