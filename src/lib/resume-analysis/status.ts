import type { Resume } from '@/types/resume';

export type ResumeAnalysisStatus = 'queued' | 'running' | 'retrying' | 'succeeded' | 'failed';

export type ResumeAnalysisState = {
  id: string;
  status: ResumeAnalysisStatus;
  progress: number;
  position: number;
  attempts: number;
  maxAttempts: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  message?: string | null;
};

export function getResumeAnalysisState(resume: Pick<Resume, 'themeConfig'>): ResumeAnalysisState | null {
  const value = (resume.themeConfig as unknown as Record<string, unknown> | null | undefined)?.analysisJob;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const state = value as Record<string, unknown>;
  const id = typeof state.id === 'string' ? state.id : '';
  const status = typeof state.status === 'string' ? state.status as ResumeAnalysisStatus : 'queued';
  if (!id || !['queued', 'running', 'retrying', 'failed', 'succeeded'].includes(status)) return null;
  return {
    id,
    status,
    progress: Number(state.progress || 0),
    position: Number(state.position || 0),
    attempts: Number(state.attempts || 0),
    maxAttempts: Number(state.maxAttempts || 3),
    errorCode: typeof state.errorCode === 'string' ? state.errorCode : null,
    errorMessage: typeof state.errorMessage === 'string' ? state.errorMessage : null,
    message: typeof state.message === 'string' ? state.message : null,
  };
}

export function isResumeAnalysisActive(resume: Pick<Resume, 'themeConfig'>) {
  const state = getResumeAnalysisState(resume);
  return !!state && ['queued', 'running', 'retrying'].includes(state.status);
}
