import { config } from '@/lib/config';
import type { Resume, ResumeSection, SectionContent } from '@/types/resume';

const SENSITIVE_KEYS = new Set([
  'fullName',
  'email',
  'phone',
  'wechat',
  'location',
  'website',
  'linkedin',
  'github',
  'avatar',
  'company',
  'institution',
  'hometown',
]);

function maskText(value: string, fallback = '***') {
  if (!value) return value;
  if (value.includes('@')) {
    const [name, domain] = value.split('@');
    return `${name.slice(0, 1) || '*'}***@${domain || '***'}`;
  }
  if (/https?:\/\//i.test(value) || value.includes('.com') || value.includes('linkedin') || value.includes('github')) {
    return 'https://***';
  }
  if (/\d/.test(value)) {
    return value.replace(/[\dA-Za-z]/g, '*');
  }
  if (value.length <= 2) return fallback;
  return `${value.slice(0, 1)}${'*'.repeat(Math.min(value.length - 1, 6))}`;
}

function maskSensitiveValue(key: string, value: unknown): unknown {
  if (value == null) return value;
  if (key === 'avatar') return '';
  if (key === 'customLinks' && Array.isArray(value)) return [];
  if (SENSITIVE_KEYS.has(key) && typeof value === 'string') return maskText(value);
  return maskSensitiveData(value);
}

function maskSensitiveData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => maskSensitiveData(item));
  if (!value || typeof value !== 'object') return value;

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    out[key] = maskSensitiveValue(key, val);
  }
  return out;
}

export function anonymizeDisplayName(name?: string | null, fallback = 'Reviewer') {
  const trimmed = name?.trim();
  if (!trimmed) return fallback;
  return `${trimmed.slice(0, 1)}***`;
}

export function sanitizeResumeForShare<T extends Resume>(resume: T, hideSensitiveInfo: boolean): T {
  if (!hideSensitiveInfo) return resume;

  return {
    ...resume,
    sections: resume.sections.map((section) => ({
      ...section,
      content: maskSensitiveData(section.content) as SectionContent,
    })) as ResumeSection[],
  };
}

export function isReviewLoginRequired() {
  return config.auth.enabled;
}

export function getReviewerDisplay(user: {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}) {
  const name = user.name?.trim() || user.email?.split('@')[0] || 'Reviewer';
  return {
    name,
    email: user.email || null,
    avatarUrl: user.avatarUrl || null,
  };
}

export function presenceColorForUser(userId: string) {
  const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}
