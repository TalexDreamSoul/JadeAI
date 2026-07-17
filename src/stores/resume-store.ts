import { create } from 'zustand';
import type { Resume, ResumeSection, SectionContent } from '@/types/resume';
import { AUTOSAVE_DELAY } from '@/lib/constants';
import { isCloudAvailable, useSettingsStore } from '@/stores/settings-store';
import { normalizeThemeConfig } from '@/lib/theme-config';
import { getLocalResume, isLocalResumeId, updateLocalResume, upsertLocalResume } from '@/lib/local-resumes';
import { normalizeSectionContent } from '@/lib/resume/normalize-content';

const LOCAL_DRAFT_PREFIX = 'touchresume_resume_draft:';

function getDraftKey(resumeId: string) {
  return `${LOCAL_DRAFT_PREFIX}${resumeId}`;
}

function toTime(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string' || typeof value === 'number') {
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  }
  return 0;
}

function buildSavePayload(resume: Resume, sections: ResumeSection[]) {
  return {
    title: resume.title,
    template: resume.template,
    themeConfig: resume.themeConfig,
    sections: sections.map((s, i) => ({
      id: s.id,
      type: s.type,
      title: s.title,
      sortOrder: i,
      visible: s.visible,
      content: s.content,
    })),
  };
}

function writeLocalDraft(resume: Resume | null, sections: ResumeSection[]) {
  if (typeof window === 'undefined' || !resume) return;
  try {
    localStorage.setItem(
      getDraftKey(resume.id),
      JSON.stringify({
        savedAt: Date.now(),
        resume: { ...resume, sections },
        sections,
      })
    );
  } catch {
    // Ignore localStorage quota / private mode errors.
  }
}

function removeLocalDraft(resumeId: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(getDraftKey(resumeId));
  } catch {
    // ignore
  }
}

function scoreMeaningfulContent(value: unknown): number {
  if (typeof value === 'string') return value.trim() ? 1 : 0;
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + scoreMeaningfulContent(item), 0);
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value as Record<string, unknown>).reduce((sum, [key, nested]) => {
      if (key === 'id' || key.endsWith('Id') || key === 'createdAt' || key === 'updatedAt') return sum;
      return sum + scoreMeaningfulContent(nested);
    }, 0);
  }
  return 0;
}

function resumeContentScore(sections: ResumeSection[] | undefined): number {
  return (sections || []).reduce((sum, section) => sum + scoreMeaningfulContent(section.content), 0);
}

function readLocalDraft(resume: Resume): Resume | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(getDraftKey(resume.id));
    if (!raw) return null;
    const draft = JSON.parse(raw) as { savedAt?: number; resume?: Resume; sections?: ResumeSection[] };
    if (!draft.resume || draft.resume.id !== resume.id) return null;

    const serverUpdatedAt = toTime(resume.updatedAt);
    if ((draft.savedAt || 0) <= serverUpdatedAt) {
      removeLocalDraft(resume.id);
      return null;
    }

    const sections = Array.isArray(draft.sections)
      ? draft.sections
      : Array.isArray(draft.resume.sections)
        ? draft.resume.sections
        : resume.sections;

    // Guard against a stale empty local draft masking a cloud resume that has real data.
    // This fixes the case where the editor/preview appears blank even though the DB resume is populated.
    if (resumeContentScore(sections) === 0 && resumeContentScore(resume.sections) > 0) {
      removeLocalDraft(resume.id);
      return null;
    }

    return { ...resume, ...draft.resume, sections };
  } catch {
    removeLocalDraft(resume.id);
    return null;
  }
}


interface ResumeStore {
  currentResume: Resume | null;
  sections: ResumeSection[];
  isDirty: boolean;
  isSaving: boolean;
  _saveTimeout: ReturnType<typeof setTimeout> | null;

  setResume: (resume: Resume) => void;
  updateSection: (sectionId: string, content: Partial<SectionContent>) => void;
  updateSectionTitle: (sectionId: string, title: string) => void;
  addSection: (section: ResumeSection) => void;
  removeSection: (sectionId: string) => void;
  reorderSections: (sections: ResumeSection[]) => void;
  toggleSectionVisibility: (sectionId: string) => void;
  setTemplate: (template: string) => void;
  setTitle: (title: string) => void;
  save: () => Promise<boolean>;
  persistLocalDraft: () => void;
  enableCloudSync: () => Promise<boolean>;
  disableCloudSync: () => Promise<boolean>;
  _scheduleSave: () => void;
  reset: () => void;
}

export const useResumeStore = create<ResumeStore>((set, get) => ({
  currentResume: null,
  sections: [],
  isDirty: false,
  isSaving: false,
  _saveTimeout: null,

  setResume: (resume) => {
    // Cancel any pending autosave to prevent stale data overwriting server changes (e.g., from AI tool calls)
    const { _saveTimeout } = get();
    if (_saveTimeout) clearTimeout(_saveTimeout);

    const localDraft = readLocalDraft(resume);
    const sourceResume = localDraft || resume;
    const normalizedThemeConfig = normalizeThemeConfig(sourceResume.themeConfig);

    // Normalize loaded content into renderer-safe shapes and restore missing ids.
    const sections = (sourceResume.sections || []).map((section) => ({
      ...section,
      content: normalizeSectionContent(section.type, section.content) as unknown as typeof section.content,
    }));

    set({
      currentResume: { ...sourceResume, themeConfig: normalizedThemeConfig, sections },
      sections,
      isDirty: !!localDraft,
      _saveTimeout: null,
    });

    // If a local resume was created before the latest save format or its stored
    // snapshot is empty, repair localStorage with the loaded in-memory data so a
    // subsequent refresh does not fall back to the blank default resume.
    if (isLocalResumeId(sourceResume.id)) {
      const stored = getLocalResume(sourceResume.id);
      if (!stored || resumeContentScore(stored.sections) < resumeContentScore(sections)) {
        updateLocalResume(sourceResume.id, {
          title: sourceResume.title,
          template: sourceResume.template,
          themeConfig: normalizedThemeConfig,
          language: sourceResume.language,
          sections,
          isBase: sourceResume.isBase,
          baseResumeId: sourceResume.baseResumeId,
          targetCompany: sourceResume.targetCompany,
          targetJobTitle: sourceResume.targetJobTitle,
          jobDescription: sourceResume.jobDescription,
          versionLabel: sourceResume.versionLabel,
        });
      }
    }
  },

  updateSection: (sectionId, content) => {
    set((state) => {
      const sections = state.sections.map((s) =>
        s.id === sectionId ? { ...s, content: { ...s.content, ...content } as SectionContent } : s
      );
      return {
        sections,
        currentResume: state.currentResume ? { ...state.currentResume, sections } : null,
        isDirty: true,
      };
    });
    get()._scheduleSave();
  },

  updateSectionTitle: (sectionId, title) => {
    set((state) => {
      const sections = state.sections.map((s) =>
        s.id === sectionId ? { ...s, title } : s
      );
      return {
        sections,
        currentResume: state.currentResume ? { ...state.currentResume, sections } : null,
        isDirty: true,
      };
    });
    get()._scheduleSave();
  },

  addSection: (section) => {
    set((state) => {
      const sections = [...state.sections, section];
      return {
        sections,
        currentResume: state.currentResume ? { ...state.currentResume, sections } : null,
        isDirty: true,
      };
    });
    get()._scheduleSave();
  },

  removeSection: (sectionId) => {
    set((state) => {
      const sections = state.sections.filter((s) => s.id !== sectionId);
      return {
        sections,
        currentResume: state.currentResume ? { ...state.currentResume, sections } : null,
        isDirty: true,
      };
    });
    get()._scheduleSave();
  },

  reorderSections: (sections) => {
    set((state) => {
      const incomingIds = new Set(sections.map((section) => section.id));
      const hiddenSections = state.sections.filter((section) => !incomingIds.has(section.id));
      const nextSections = [...sections, ...hiddenSections].map((section, index) => ({
        ...section,
        sortOrder: index,
      }));

      return {
        sections: nextSections,
        currentResume: state.currentResume ? { ...state.currentResume, sections: nextSections } : null,
        isDirty: true,
      };
    });
    get()._scheduleSave();
  },

  toggleSectionVisibility: (sectionId) => {
    set((state) => {
      const sections = state.sections.map((s) =>
        s.id === sectionId ? { ...s, visible: !s.visible } : s
      );
      return {
        sections,
        currentResume: state.currentResume ? { ...state.currentResume, sections } : null,
        isDirty: true,
      };
    });
    get()._scheduleSave();
  },

  setTemplate: (template) => {
    set((state) => ({
      currentResume: state.currentResume
        ? { ...state.currentResume, template }
        : null,
      isDirty: true,
    }));
    get()._scheduleSave();
  },

  setTitle: (title) => {
    set((state) => ({
      currentResume: state.currentResume
        ? { ...state.currentResume, title }
        : null,
      isDirty: true,
    }));
    get()._scheduleSave();
  },

  persistLocalDraft: () => {
    const { currentResume, sections } = get();
    writeLocalDraft(currentResume, sections);
  },

  save: async () => {
    const { currentResume, sections, isDirty } = get();
    if (!currentResume) return false;
    if (!isDirty) return true;

    set({ isSaving: true });
    try {
      if (!isCloudAvailable() || isLocalResumeId(currentResume.id) || currentResume.cloudSyncEnabled === false) {
        const updated = updateLocalResume(currentResume.id, {
          title: currentResume.title,
          template: currentResume.template,
          themeConfig: currentResume.themeConfig,
          language: currentResume.language,
          sections,
          isBase: currentResume.isBase,
          baseResumeId: currentResume.baseResumeId,
          targetCompany: currentResume.targetCompany,
          targetJobTitle: currentResume.targetJobTitle,
          jobDescription: currentResume.jobDescription,
          versionLabel: currentResume.versionLabel,
        });
        if (!updated) throw new Error('Local resume could not be saved');
        set((state) => ({
          currentResume: state.currentResume ? { ...state.currentResume, cloudSyncEnabled: false } : null,
          isDirty: false,
        }));
        return true;
      }

      const fingerprint = typeof window !== 'undefined'
        ? localStorage.getItem('touchresume_fingerprint')
        : null;

      const response = await fetch(`/api/resume/${currentResume.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(fingerprint ? { 'x-fingerprint': fingerprint } : {}),
        },
        body: JSON.stringify({
          ...buildSavePayload(currentResume, sections),
        }),
      });
      if (!response.ok) throw new Error(`Resume save failed with HTTP ${response.status}`);

      removeLocalDraft(currentResume.id);
      set({ isDirty: false });
      return true;
    } catch (error) {
      console.error('Failed to save resume:', error);
      return false;
    } finally {
      set({ isSaving: false });
    }
  },

  enableCloudSync: async () => {
    const { currentResume, sections } = get();
    if (!currentResume) return false;
    if (!isCloudAvailable()) return false;

    set({ isSaving: true });
    try {
      const payload = buildSavePayload(currentResume, sections);
      const fingerprint = typeof window !== 'undefined'
        ? localStorage.getItem('touchresume_fingerprint')
        : null;
      const headers = {
        'Content-Type': 'application/json',
        ...(fingerprint ? { 'x-fingerprint': fingerprint } : {}),
      };

      if (isLocalResumeId(currentResume.id)) {
        const res = await fetch('/api/resume/upload-local', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            ...currentResume,
            ...payload,
            sections,
            cloudSyncEnabled: true,
          }),
        });
        if (!res.ok) return false;
        const uploaded = await res.json();
        removeLocalDraft(currentResume.id);
        set({
          currentResume: {
            ...uploaded,
            sections: uploaded.sections || [],
            themeConfig: normalizeThemeConfig(uploaded.themeConfig),
            createdAt: new Date(uploaded.createdAt),
            updatedAt: new Date(uploaded.updatedAt),
          },
          sections: uploaded.sections || [],
          isDirty: false,
        });
        return true;
      }

      const res = await fetch(`/api/resume/${currentResume.id}/sync-mode`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...currentResume,
          ...payload,
          mode: 'cloud',
          sections,
          cloudSyncEnabled: true,
        }),
      });
      if (!res.ok) return false;
      const updated = await res.json();
      removeLocalDraft(currentResume.id);
      set({
        currentResume: {
          ...updated,
          sections: updated.sections || [],
          themeConfig: normalizeThemeConfig(updated.themeConfig),
          createdAt: new Date(updated.createdAt),
          updatedAt: new Date(updated.updatedAt),
        },
        sections: updated.sections || [],
        isDirty: false,
      });
      return true;
    } catch (error) {
      console.error('Failed to enable cloud sync:', error);
      return false;
    } finally {
      set({ isSaving: false });
    }
  },

  disableCloudSync: async () => {
    const { currentResume, sections } = get();
    if (!currentResume || isLocalResumeId(currentResume.id)) return false;

    set({ isSaving: true });
    try {
      const nextLocalId = `local_${currentResume.id}`;
      const savedLocalResume = upsertLocalResume(nextLocalId, {
        title: currentResume.title,
        template: currentResume.template,
        themeConfig: currentResume.themeConfig,
        language: currentResume.language,
        sections,
        isBase: currentResume.isBase,
        baseResumeId: currentResume.baseResumeId,
        targetCompany: currentResume.targetCompany,
        targetJobTitle: currentResume.targetJobTitle,
        jobDescription: currentResume.jobDescription,
        versionLabel: currentResume.versionLabel,
      });
      const fingerprint = typeof window !== 'undefined'
        ? localStorage.getItem('touchresume_fingerprint')
        : null;
      const res = await fetch(`/api/resume/${currentResume.id}/sync-mode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(fingerprint ? { 'x-fingerprint': fingerprint } : {}),
        },
        body: JSON.stringify({ mode: 'local' }),
      });
      if (!res.ok) return false;
      removeLocalDraft(currentResume.id);
      set({
        currentResume: { ...savedLocalResume, cloudSyncEnabled: false, sections },
        sections,
        isDirty: false,
      });
      return true;
    } catch (error) {
      console.error('Failed to disable cloud sync:', error);
      return false;
    } finally {
      set({ isSaving: false });
    }
  },

  _scheduleSave: () => {
    const { currentResume, sections, _saveTimeout } = get();
    writeLocalDraft(currentResume, sections);
    if (_saveTimeout) clearTimeout(_saveTimeout);

    const { autoSave, autoSaveInterval, _hydrated } = useSettingsStore.getState();

    // If settings are hydrated and autoSave is off, only mark dirty, don't auto-save
    if (_hydrated && !autoSave) {
      set({ _saveTimeout: null });
      return;
    }

    const delay = _hydrated ? autoSaveInterval : AUTOSAVE_DELAY;
    const timeout = setTimeout(() => {
      get().save();
    }, delay);

    set({ _saveTimeout: timeout });
  },

  reset: () => {
    const { _saveTimeout } = get();
    if (_saveTimeout) clearTimeout(_saveTimeout);
    set({
      currentResume: null,
      sections: [],
      isDirty: false,
      isSaving: false,
      _saveTimeout: null,
    });
  },
}));
