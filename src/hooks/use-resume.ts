'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  createLocalResume,
  deleteLocalResume,
  duplicateLocalResume,
  getLocalResumes,
  isLocalResumeId,
  updateLocalResume,
  type LocalResumeInput,
} from '@/lib/local-resumes';
import { useIsLocalOnly } from '@/stores/settings-store';
import type { Resume } from '@/types/resume';

function getHeaders() {
  const fingerprint = typeof window !== 'undefined' ? localStorage.getItem('touchresume_fingerprint') : null;
  return {
    'Content-Type': 'application/json',
    ...(fingerprint ? { 'x-fingerprint': fingerprint } : {}),
  };
}

type ResumeListUpdater = Resume[] | ((prev: Resume[]) => Resume[]);

export function useResume() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const localOnly = useIsLocalOnly();
  const resumesRef = useRef<Resume[]>([]);
  const hasFetchedRef = useRef(false);
  const activeInitialLoadsRef = useRef(0);
  const activeRefreshesRef = useRef(0);
  const fetchVersionRef = useRef(0);

  const setResumeList = useCallback((updater: ResumeListUpdater) => {
    setResumes((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      resumesRef.current = next;
      return next;
    });
  }, []);

  const fetchResumes = useCallback(async () => {
    const fetchVersion = ++fetchVersionRef.current;
    const shouldShowInitialLoading = !hasFetchedRef.current && resumesRef.current.length === 0;
    if (shouldShowInitialLoading) {
      activeInitialLoadsRef.current += 1;
      setIsLoading(true);
    } else {
      activeRefreshesRef.current += 1;
      setIsRefreshing(true);
    }

    try {
      const localResumes = getLocalResumes();
      if (localOnly) {
        if (fetchVersion === fetchVersionRef.current) setResumeList(localResumes);
        return;
      }

      const res = await fetch('/api/resume', { headers: getHeaders() });
      if (fetchVersion !== fetchVersionRef.current) return;

      if (res.ok) {
        const data = await res.json();
        const cloudResumes = Array.isArray(data)
          ? data.filter((resume: Resume) => resume.cloudSyncEnabled !== false)
          : [];
        setResumeList([...cloudResumes, ...localResumes]);
      } else if (resumesRef.current.length === 0) {
        setResumeList(localResumes);
      }
    } catch (error) {
      if (fetchVersion !== fetchVersionRef.current) return;
      console.error('Failed to fetch resumes:', error);
      if (resumesRef.current.length === 0) setResumeList(getLocalResumes());
    } finally {
      if (fetchVersion === fetchVersionRef.current) hasFetchedRef.current = true;
      if (shouldShowInitialLoading) {
        activeInitialLoadsRef.current = Math.max(0, activeInitialLoadsRef.current - 1);
        if (activeInitialLoadsRef.current === 0) setIsLoading(false);
      } else {
        activeRefreshesRef.current = Math.max(0, activeRefreshesRef.current - 1);
        if (activeRefreshesRef.current === 0) setIsRefreshing(false);
      }
    }
  }, [localOnly, setResumeList]);

  const upsertResume = useCallback((resume: Resume) => {
    setResumeList((prev) => [resume, ...prev.filter((item) => item.id !== resume.id)]);
  }, [setResumeList]);

  const createResume = useCallback(async (data: LocalResumeInput) => {
    try {
      if (localOnly) {
        const resume = createLocalResume({ ...data, cloudSyncEnabled: false });
        setResumeList((prev) => [resume, ...prev]);
        return resume;
      }

      const res = await fetch('/api/resume', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ ...data, cloudSyncEnabled: data.cloudSyncEnabled ?? true }),
      });
      if (res.ok) {
        const resume = await res.json();
        setResumeList((prev) => [resume, ...prev]);
        return resume;
      }
    } catch (error) {
      console.error('Failed to create resume:', error);
    }
    return null;
  }, [localOnly, setResumeList]);

  const deleteResume = useCallback(async (id: string) => {
    try {
      if (localOnly || isLocalResumeId(id)) {
        const ok = deleteLocalResume(id);
        if (ok) setResumeList((prev) => prev.filter((r) => r.id !== id));
        return ok;
      }

      const res = await fetch(`/api/resume/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (res.ok) {
        setResumeList((prev) => prev.filter((r) => r.id !== id));
        return true;
      }
    } catch (error) {
      console.error('Failed to delete resume:', error);
    }
    return false;
  }, [localOnly, setResumeList]);

  const renameResume = useCallback(async (id: string, title: string) => {
    try {
      if (localOnly || isLocalResumeId(id)) {
        const updated = updateLocalResume(id, { title });
        if (updated) {
          setResumeList((prev) => prev.map((r) => r.id === id ? updated : r));
          return true;
        }
        return false;
      }

      const res = await fetch(`/api/resume/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ title }),
      });
      if (res.ok) {
        setResumeList((prev) => prev.map((r) => r.id === id ? { ...r, title } : r));
        return true;
      }
    } catch (error) {
      console.error('Failed to rename resume:', error);
    }
    return false;
  }, [localOnly, setResumeList]);

  const retryAnalysisJob = useCallback(async (jobId: string) => {
    try {
      if (localOnly) return false;
      const res = await fetch(`/api/resume/analysis-jobs/${jobId}/retry`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (res.ok) {
        await fetchResumes();
        return true;
      }
    } catch (error) {
      console.error('Failed to retry analysis job:', error);
    }
    return false;
  }, [fetchResumes, localOnly]);

  const duplicateResume = useCallback(async (id: string) => {
    try {
      if (localOnly || isLocalResumeId(id)) {
        const resume = duplicateLocalResume(id);
        if (resume) setResumeList((prev) => [resume, ...prev]);
        return resume;
      }

      const res = await fetch(`/api/resume/${id}/duplicate`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (res.ok) {
        const resume = await res.json();
        setResumeList((prev) => [resume, ...prev]);
        return resume;
      }
    } catch (error) {
      console.error('Failed to duplicate resume:', error);
    }
    return null;
  }, [localOnly, setResumeList]);

  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') fetchResumes();
    };
    window.addEventListener('focus', handler);
    window.addEventListener('pageshow', handler);
    document.addEventListener('visibilitychange', handler);
    return () => {
      window.removeEventListener('focus', handler);
      window.removeEventListener('pageshow', handler);
      document.removeEventListener('visibilitychange', handler);
    };
  }, [fetchResumes]);

  return {
    resumes,
    isLoading,
    isRefreshing,
    fetchResumes,
    upsertResume,
    createResume,
    deleteResume,
    renameResume,
    retryAnalysisJob,
    duplicateResume,
  };
}
