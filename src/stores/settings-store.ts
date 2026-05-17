import { create } from 'zustand';

export type AIProvider = 'openai' | 'anthropic' | 'gemini';
export type AIMode = 'server' | 'custom';
export type OpenAIEndpoint = 'chat' | 'responses';

interface SettingsStore {
  // AI settings
  aiMode: AIMode;
  aiProvider: AIProvider;
  aiApiKey: string; // stored locally only, never persisted to the app database
  aiBaseURL: string;
  aiModel: string;
  openAIEndpoint: OpenAIEndpoint;
  serverAIConfigured: boolean;
  serverAIProvider: AIProvider;
  serverAIModel: string;
  serverOpenAIEndpoint: OpenAIEndpoint;
  serverImageAIConfigured: boolean;
  // Editor settings
  autoSave: boolean;
  autoSaveInterval: number; // in milliseconds

  // Hydration state
  _hydrated: boolean;
  _syncing: boolean;

  // Actions
  setAIMode: (mode: AIMode) => void;
  setAIProvider: (provider: AIProvider) => void;
  setAIApiKey: (key: string) => void;
  setAIBaseURL: (url: string) => void;
  setAIModel: (model: string) => void;
  setOpenAIEndpoint: (endpoint: OpenAIEndpoint) => void;
  setAutoSave: (enabled: boolean) => void;
  setAutoSaveInterval: (interval: number) => void;
  hydrate: () => void;
}

const API_KEY_STORAGE_KEY = 'touchresume_api_key';
const PROVIDER_CONFIGS_KEY = 'touchresume_provider_configs';

interface ProviderConfig {
  baseURL: string;
  model: string;
  apiKey: string;
  openAIEndpoint?: OpenAIEndpoint;
}

const PROVIDER_DEFAULTS: Record<AIProvider, ProviderConfig> = {
  openai: { baseURL: 'https://api.openai.com/v1', model: 'gpt-4o', apiKey: '' },
  anthropic: { baseURL: 'https://api.anthropic.com', model: 'claude-sonnet-4-20250514', apiKey: '' },
  gemini: { baseURL: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.0-flash', apiKey: '' },
};

function normalizeProvider(value: unknown): AIProvider | undefined {
  if (value === 'anthropic' || value === 'gemini' || value === 'openai') return value;
  if (value === 'custom' || value === 'azure') return 'openai';
  return undefined;
}

function normalizeMode(value: unknown, serverAIConfigured: boolean): AIMode {
  if (value === 'server' || value === 'custom') return value;
  return serverAIConfigured ? 'server' : 'custom';
}

function normalizeOpenAIEndpoint(value: unknown): OpenAIEndpoint {
  return value === 'responses' ? 'responses' : 'chat';
}

function loadProviderConfigs(): Partial<Record<AIProvider, ProviderConfig>> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(PROVIDER_CONFIGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveProviderConfigs(configs: Partial<Record<AIProvider, ProviderConfig>>) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(PROVIDER_CONFIGS_KEY, JSON.stringify(configs)); } catch { /* ignore */ }
}

function getFingerprint(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('touchresume_fingerprint');
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
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    try {
      await fetch('/api/user/settings', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          aiMode: state.aiMode,
          aiProvider: state.aiProvider,
          aiBaseURL: state.aiBaseURL,
          aiModel: state.aiModel,
          openAIEndpoint: state.openAIEndpoint,
          autoSave: state.autoSave,
          autoSaveInterval: state.autoSaveInterval,
        }),
      });
    } catch {
      // silently fail, local state is still correct
    }
  }, 500);
}

function syncProviderConfig(state: SettingsStore) {
  const configs = loadProviderConfigs();
  configs[state.aiProvider] = {
    baseURL: state.aiBaseURL,
    model: state.aiModel,
    apiKey: state.aiApiKey,
    ...(state.aiProvider === 'openai' ? { openAIEndpoint: state.openAIEndpoint } : {}),
  };
  saveProviderConfigs(configs);
}

function saveApiKeyLocally(key: string) {
  if (typeof window === 'undefined') return;
  try {
    if (key) {
      localStorage.setItem(API_KEY_STORAGE_KEY, key);
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  } catch { /* ignore */ }
}

function loadApiKeyLocally(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function hasUsableAIConfig(): boolean {
  const { aiMode, aiApiKey, serverAIConfigured } = useSettingsStore.getState();
  return aiMode === 'server' ? serverAIConfigured : !!aiApiKey;
}

export function getAIHeaders(): Record<string, string> {
  const { aiMode, aiProvider, aiApiKey, aiBaseURL, aiModel, openAIEndpoint } = useSettingsStore.getState();
  const headers: Record<string, string> = { 'x-ai-mode': aiMode };

  // In unified mode the API key/base URL/model are read from server env vars.
  // Never send personal credentials when the user selected unified AI.
  if (aiMode === 'server') {
    return headers;
  }

  if (aiProvider) headers['x-provider'] = aiProvider;
  if (aiApiKey) headers['x-api-key'] = aiApiKey;
  if (aiBaseURL) headers['x-base-url'] = aiBaseURL;
  if (aiModel) headers['x-model'] = aiModel;
  if (aiProvider === 'openai') headers['x-openai-endpoint'] = openAIEndpoint;
  return headers;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  aiMode: 'server',
  aiProvider: 'openai',
  aiApiKey: '',
  aiBaseURL: 'https://api.openai.com/v1',
  aiModel: 'gpt-4o',
  openAIEndpoint: 'chat',
  serverAIConfigured: false,
  serverAIProvider: 'openai',
  serverAIModel: 'gpt-4o',
  serverOpenAIEndpoint: 'chat',
  serverImageAIConfigured: false,
  autoSave: true,
  autoSaveInterval: 500,
  _hydrated: false,
  _syncing: false,

  setAIMode: (mode) => {
    set({ aiMode: mode });
    syncToServer(get());
  },

  setAIProvider: (provider) => {
    const { aiProvider: prev, aiBaseURL, aiModel, aiApiKey, openAIEndpoint } = get();

    // Save current provider's config before switching
    const configs = loadProviderConfigs();
    configs[prev] = {
      baseURL: aiBaseURL,
      model: aiModel,
      apiKey: aiApiKey,
      ...(prev === 'openai' ? { openAIEndpoint } : {}),
    };
    saveProviderConfigs(configs);

    // Restore target provider's cached config, or use defaults
    const cached = configs[provider];
    const defaults = PROVIDER_DEFAULTS[provider];
    const restored = cached || defaults;

    set({
      aiProvider: provider,
      aiBaseURL: restored.baseURL,
      aiModel: restored.model,
      aiApiKey: restored.apiKey,
      openAIEndpoint: normalizeOpenAIEndpoint(restored.openAIEndpoint),
    });
    saveApiKeyLocally(restored.apiKey);
    syncToServer(get());
  },

  setAIApiKey: (key) => {
    set({ aiApiKey: key });
    saveApiKeyLocally(key);
    syncProviderConfig(get());
  },

  setAIBaseURL: (url) => {
    set({ aiBaseURL: url });
    syncToServer(get());
    syncProviderConfig(get());
  },

  setAIModel: (model) => {
    set({ aiModel: model });
    syncToServer(get());
    syncProviderConfig(get());
  },

  setOpenAIEndpoint: (endpoint) => {
    set({ openAIEndpoint: endpoint });
    syncToServer(get());
    syncProviderConfig(get());
  },

  setAutoSave: (enabled) => {
    set({ autoSave: enabled });
    syncToServer(get());
  },

  setAutoSaveInterval: (interval) => {
    set({ autoSaveInterval: interval });
    syncToServer(get());
  },

  hydrate: async () => {
    if (get()._hydrated) return;

    // Load API key from localStorage immediately
    const apiKey = loadApiKeyLocally();
    set({ aiApiKey: apiKey });

    // Load other settings from server
    try {
      const res = await fetch('/api/user/settings', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const serverAIConfigured = !!data.serverAIConfigured;
        const provider = normalizeProvider(data.aiProvider);
        const serverProvider = normalizeProvider(data.serverAIProvider) || 'openai';
        set({
          aiMode: normalizeMode(data.aiMode, serverAIConfigured),
          ...(provider && { aiProvider: provider }),
          ...(data.aiBaseURL && { aiBaseURL: data.aiBaseURL }),
          ...(data.aiModel && { aiModel: data.aiModel }),
          openAIEndpoint: normalizeOpenAIEndpoint(data.openAIEndpoint),
          serverAIConfigured,
          serverAIProvider: serverProvider,
          serverAIModel: typeof data.serverAIModel === 'string' ? data.serverAIModel : PROVIDER_DEFAULTS[serverProvider].model,
          serverOpenAIEndpoint: normalizeOpenAIEndpoint(data.serverOpenAIEndpoint),
          serverImageAIConfigured: !!data.serverImageAIConfigured,
          ...(typeof data.autoSave === 'boolean' && { autoSave: data.autoSave }),
          ...(typeof data.autoSaveInterval === 'number' && { autoSaveInterval: data.autoSaveInterval }),
          _hydrated: true,
        });
        // Seed provider config cache with hydrated values
        syncProviderConfig(get());
        return;
      }
    } catch { /* fall through */ }

    set({ aiMode: 'custom', _hydrated: true });
  },
}));

// Auto-hydrate on client side so settings are ready before any component uses them
if (typeof window !== 'undefined') {
  useSettingsStore.getState().hydrate();
}
