import type { UIMessage } from 'ai';
import { generateId } from '@/lib/utils';

const KEY_PREFIX = 'touchresume_local_chat_sessions:';

export interface LocalChatSession {
  id: string;
  title: string;
  resumeId: string;
  messages: UIMessage[];
  createdAt: number;
  updatedAt: number;
}

function key(resumeId: string) {
  return `${KEY_PREFIX}${resumeId}`;
}

function canUseStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function read(resumeId: string): LocalChatSession[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(key(resumeId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is LocalChatSession => item && typeof item.id === 'string');
  } catch {
    return [];
  }
}

function write(resumeId: string, sessions: LocalChatSession[]) {
  if (!canUseStorage()) return;
  localStorage.setItem(key(resumeId), JSON.stringify(sessions));
}

export function listLocalChatSessions(resumeId: string): LocalChatSession[] {
  return read(resumeId).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function createLocalChatSession(resumeId: string, title = '新对话'): LocalChatSession {
  const now = Date.now();
  const session: LocalChatSession = {
    id: `local_chat_${generateId()}`,
    title,
    resumeId,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  write(resumeId, [session, ...read(resumeId)]);
  return session;
}

export function getLocalChatSession(resumeId: string, sessionId: string): LocalChatSession | null {
  return read(resumeId).find((session) => session.id === sessionId) || null;
}

export function updateLocalChatSession(resumeId: string, sessionId: string, patch: Partial<Pick<LocalChatSession, 'title' | 'messages'>>): LocalChatSession | null {
  const sessions = read(resumeId);
  const index = sessions.findIndex((session) => session.id === sessionId);
  if (index < 0) return null;
  const updated = { ...sessions[index], ...patch, updatedAt: Date.now() };
  sessions[index] = updated;
  write(resumeId, sessions);
  return updated;
}

export function deleteLocalChatSession(resumeId: string, sessionId: string): boolean {
  const sessions = read(resumeId);
  const next = sessions.filter((session) => session.id !== sessionId);
  write(resumeId, next);
  return next.length !== sessions.length;
}
