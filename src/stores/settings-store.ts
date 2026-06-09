import { create } from 'zustand';
import { useRuntimeConfig } from '@/components/providers/runtime-config-provider';

export type AIProvider = 'openai' | 'anthropic' | 'gemini';
export type OpenAIEndpoint = 'chat' | 'responses';

interface SettingsStore {
  // AI settings
  serverAIConfigured: boolean;
  serverAIAvailable: boolean;
  serverAIProvider: AIProvider;
  serverAIModel: string;
  serverOpenAIEndpoint: OpenAIEndpoint;
  serverImageAIConfigured: boolean;
  aiCredits: number;
  // Editor settings
  autoSave: boolean;
  autoSaveInterval: number; // in milliseconds
  browserNotifications: boolean;

  // Hydration state
  _hydrated: boolean;
  _localOnlyHydrated: boolean;
  _syncing: boolean;

  // Actions
  setAutoSave: (enabled: boolean) => void;
  setAutoSaveInterval: (interval: number) => void;
  setBrowserNotifications: (enabled: boolean) => void;
  hydrate: (localOnly?: boolean) => void;
}

const DEFAULT_MODELS: Record<AIProvider, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-20250514',
  gemini: 'gemini-2.0-flash',
};

function normalizeProvider(value: unknown): AIProvider | undefined {
  if (value === 'anthropic' || value === 'gemini' || value === 'openai') return value;
  if (value === 'custom' || value === 'azure') return 'openai';
  return undefined;
}

function normalizeOpenAIEndpoint(value: unknown): OpenAIEndpoint {
  return value === 'responses' ? 'responses' : 'chat';
}

function getFingerprint(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('touchresume_fingerprint');
}

export function isCloudAvailable(): boolean {
  if (typeof window === 'undefined') return true;
  return document.documentElement.dataset.localOnly !== 'true';
}

function getHeaders(): Record<string, string> {
  const fp = getFingerprint();
  return {
    'Content-Type': 'application/json',
    ...(fp ? { 'x-fingerprint': fp } : {}),
  };
}

// Sync settings to server (debounced)
let syncTimeout: ReturnType<typeof setTimeout> | null = null;

function syncToServer(state: SettingsStore) {
  if (!isCloudAvailable()) return;
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    try {
      await fetch('/api/user/settings', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          autoSave: state.autoSave,
          autoSaveInterval: state.autoSaveInterval,
          browserNotifications: state.browserNotifications,
        }),
      });
    } catch {
      // silently fail, local state is still correct
    }
  }, 500);
}

export function hasUsableAIConfig(): boolean {
  return useSettingsStore.getState().serverAIAvailable;
}

export function getAIHeaders(): Record<string, string> {
  return { 'x-ai-mode': 'server' };
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  serverAIConfigured: false,
  serverAIAvailable: false,
  serverAIProvider: 'openai',
  serverAIModel: 'gpt-4o',
  serverOpenAIEndpoint: 'chat',
  serverImageAIConfigured: false,
  aiCredits: 0,
  autoSave: true,
  autoSaveInterval: 500,
  browserNotifications: false,
  _hydrated: false,
  _localOnlyHydrated: false,
  _syncing: false,

  setAutoSave: (enabled) => {
    set({ autoSave: enabled });
    syncToServer(get());
  },

  setAutoSaveInterval: (interval) => {
    set({ autoSaveInterval: interval });
    syncToServer(get());
  },

  setBrowserNotifications: (enabled) => {
    set({ browserNotifications: enabled });
    syncToServer(get());
  },

  hydrate: async (localOnly = false) => {
    const current = get();
    if (current._hydrated && (localOnly || !current._localOnlyHydrated)) return;

    if (localOnly || !isCloudAvailable()) {
      set({
        autoSave: true,
        serverAIConfigured: false,
        serverAIAvailable: false,
        serverImageAIConfigured: false,
        aiCredits: 0,
        _hydrated: true,
        _localOnlyHydrated: true,
      });
      return;
    }

    // Load other settings from server
    try {
      const res = await fetch('/api/user/settings', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const serverAIConfigured = !!data.serverAIConfigured;
        const serverAIAvailable =
          typeof data.serverAIAvailable === 'boolean'
            ? data.serverAIAvailable
            : serverAIConfigured && typeof data.aiCredits === 'number' && data.aiCredits > 0;
        const serverProvider = normalizeProvider(data.serverAIProvider) || 'openai';
        const serverAIModel = typeof data.serverAIModel === 'string' ? data.serverAIModel : DEFAULT_MODELS[serverProvider];
        set({
          serverAIConfigured,
          serverAIAvailable,
          serverAIProvider: serverProvider,
          serverAIModel,
          serverOpenAIEndpoint: normalizeOpenAIEndpoint(data.serverOpenAIEndpoint),
          serverImageAIConfigured: !!data.serverImageAIConfigured,
          aiCredits: typeof data.aiCredits === 'number' ? data.aiCredits : 0,
          ...(typeof data.autoSave === 'boolean' && { autoSave: data.autoSave }),
          ...(typeof data.autoSaveInterval === 'number' && { autoSaveInterval: data.autoSaveInterval }),
          ...(typeof data.browserNotifications === 'boolean' && { browserNotifications: data.browserNotifications }),
          _hydrated: true,
          _localOnlyHydrated: false,
        });
        return;
      }
    } catch { /* fall through */ }

    set({ serverAIAvailable: false, _hydrated: true, _localOnlyHydrated: false });
  },
}));

export function useIsLocalOnly(): boolean {
  return useRuntimeConfig().localOnly;
}
