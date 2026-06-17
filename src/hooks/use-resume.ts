'use client';

import { useState, useCallback, useEffect } from 'react';
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

export function useResume() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const localOnly = useIsLocalOnly();

  const fetchResumes = useCallback(async () => {
    setIsLoading(true);
    try {
      if (localOnly) {
        setResumes(getLocalResumes());
        return;
      }

      const res = await fetch('/api/resume', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const cloudResumes = Array.isArray(data)
          ? data.filter((resume: Resume) => resume.cloudSyncEnabled !== false)
          : [];
        setResumes([...cloudResumes, ...getLocalResumes()]);
      } else {
        setResumes(getLocalResumes());
      }
    } catch (error) {
      console.error('Failed to fetch resumes:', error);
    } finally {
      setIsLoading(false);
    }
  }, [localOnly]);

  const createResume = useCallback(async (data: LocalResumeInput) => {
    try {
      if (localOnly) {
        const resume = createLocalResume({ ...data, cloudSyncEnabled: false });
        setResumes((prev) => [resume, ...prev]);
        return resume;
      }

      const res = await fetch('/api/resume', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ ...data, cloudSyncEnabled: data.cloudSyncEnabled ?? true }),
      });
      if (res.ok) {
        const resume = await res.json();
        setResumes((prev) => [resume, ...prev]);
        return resume;
      }
    } catch (error) {
      console.error('Failed to create resume:', error);
    }
    return null;
  }, [localOnly]);

  const deleteResume = useCallback(async (id: string) => {
    try {
      if (localOnly || isLocalResumeId(id)) {
        const ok = deleteLocalResume(id);
        if (ok) setResumes((prev) => prev.filter((r) => r.id !== id));
        return ok;
      }

      const res = await fetch(`/api/resume/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (res.ok) {
        setResumes((prev) => prev.filter((r) => r.id !== id));
        return true;
      }
    } catch (error) {
      console.error('Failed to delete resume:', error);
    }
    return false;
  }, [localOnly]);

  const renameResume = useCallback(async (id: string, title: string) => {
    try {
      if (localOnly || isLocalResumeId(id)) {
        const updated = updateLocalResume(id, { title });
        if (updated) {
          setResumes((prev) => prev.map((r) => r.id === id ? updated : r));
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
        setResumes((prev) => prev.map((r) => r.id === id ? { ...r, title } : r));
        return true;
      }
    } catch (error) {
      console.error('Failed to rename resume:', error);
    }
    return false;
  }, [localOnly]);

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
        if (resume) setResumes((prev) => [resume, ...prev]);
        return resume;
      }

      const res = await fetch(`/api/resume/${id}/duplicate`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (res.ok) {
        const resume = await res.json();
        setResumes((prev) => [resume, ...prev]);
        return resume;
      }
    } catch (error) {
      console.error('Failed to duplicate resume:', error);
    }
    return null;
  }, [localOnly]);

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
    fetchResumes,
    createResume,
    deleteResume,
    renameResume,
    retryAnalysisJob,
    duplicateResume,
  };
}
