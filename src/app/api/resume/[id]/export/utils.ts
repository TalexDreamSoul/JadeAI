import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import { BACKGROUND_TEMPLATES } from '@/lib/constants';
import { buildTemplateCustomizationCSS } from '@/lib/template-customization';
import type {
  PersonalInfoContent,
  QrCodeItem,
  SkillsContent,
  SummaryContent,
  ThemeConfig,
} from '@/types/resume';

export type ResumeWithSections = NonNullable<Awaited<ReturnType<typeof resumeRepository.findById>>>;
export type Section = ResumeWithSections['sections'][number];

// ─── Helpers ──────────────────────────────────────────────────

export function esc(text: unknown): string {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function safe(val: unknown): string {
  return val != null ? String(val) : '';
}

type PersonalInfoItemsOptions = {
  includeJobTitle?: boolean;
  includeLinks?: boolean;
};

type PersonalInfoExportItem = {
  key: string;
  value: string;
  icon: string;
};

type ContactHtmlOptions = PersonalInfoItemsOptions & {
  itemTag?: 'span' | 'p' | 'div';
  itemClass?: string;
  iconClass?: string;
  valueClass?: string;
};

const PERSONAL_INFO_ICON_SVG: Record<string, string> = {
  briefcase: '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.11 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.8 12.8 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.8 12.8 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  'map-pin': '<path d="M20 10c0 4.99-5.52 10.2-7.4 11.8a1 1 0 0 1-1.2 0C9.52 20.2 4 14.99 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  'message-circle': '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/>',
  github: '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65S8.93 17.38 9 18v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>',
  linkedin: '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>',
  cake: '<path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v3"/><path d="M12 8v3"/><path d="M17 8v3"/><path d="M7 4h.01"/><path d="M12 4h.01"/><path d="M17 4h.01"/>',
  flag: '<path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 8 2a6 6 0 0 0 4-1v11a6 6 0 0 1-4 1c-3 0-5-2-8-2a6 6 0 0 0-4 1"/>',
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7z"/>',
  'graduation-cap': '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
};

const PERSONAL_INFO_ICON_BY_VALUE = new Set(Object.keys(PERSONAL_INFO_ICON_SVG));

function asText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function iconFor(personalInfo: PersonalInfoContent, key: string, fallback: string): string {
  const customIcon = personalInfo.personalInfoIcons?.[key];
  if (customIcon === 'hidden') return 'hidden';
  if (customIcon && PERSONAL_INFO_ICON_BY_VALUE.has(customIcon)) return customIcon;
  return fallback;
}

export function getPersonalInfoExportItems(
  personalInfo: PersonalInfoContent,
  options: PersonalInfoItemsOptions = {},
): PersonalInfoExportItem[] {
  const { includeJobTitle = false, includeLinks = true } = options;
  const items: Array<Omit<PersonalInfoExportItem, 'value'> & { value?: string | number | null }> = [
    { key: 'jobTitle', value: includeJobTitle ? personalInfo.jobTitle : undefined, icon: iconFor(personalInfo, 'jobTitle', 'briefcase') },
    { key: 'age', value: personalInfo.age, icon: iconFor(personalInfo, 'age', 'cake') },
    { key: 'politicalStatus', value: personalInfo.politicalStatus, icon: iconFor(personalInfo, 'politicalStatus', 'flag') },
    { key: 'gender', value: personalInfo.gender, icon: iconFor(personalInfo, 'gender', 'user') },
    { key: 'ethnicity', value: personalInfo.ethnicity, icon: iconFor(personalInfo, 'ethnicity', 'users') },
    { key: 'hometown', value: personalInfo.hometown, icon: iconFor(personalInfo, 'hometown', 'home') },
    { key: 'maritalStatus', value: personalInfo.maritalStatus, icon: iconFor(personalInfo, 'maritalStatus', 'heart') },
    { key: 'yearsOfExperience', value: personalInfo.yearsOfExperience, icon: iconFor(personalInfo, 'yearsOfExperience', 'briefcase') },
    { key: 'educationLevel', value: personalInfo.educationLevel, icon: iconFor(personalInfo, 'educationLevel', 'graduation-cap') },
    { key: 'email', value: personalInfo.email, icon: iconFor(personalInfo, 'email', 'mail') },
    { key: 'phone', value: personalInfo.phone, icon: iconFor(personalInfo, 'phone', 'phone') },
    { key: 'wechat', value: personalInfo.wechat, icon: iconFor(personalInfo, 'wechat', 'message-circle') },
    { key: 'location', value: personalInfo.location, icon: iconFor(personalInfo, 'location', 'map-pin') },
    { key: 'website', value: personalInfo.website, icon: iconFor(personalInfo, 'website', 'globe') },
    { key: 'linkedin', value: includeLinks ? personalInfo.linkedin : undefined, icon: iconFor(personalInfo, 'linkedin', 'linkedin') },
    { key: 'github', value: includeLinks ? personalInfo.github : undefined, icon: iconFor(personalInfo, 'github', 'github') },
  ];

  return items
    .map((item) => ({ ...item, value: asText(item.value) }))
    .filter((item): item is PersonalInfoExportItem => Boolean(item.value));
}

export function renderPersonalInfoIcon(icon: string, iconClass = 'h-3 w-3 shrink-0'): string {
  if (icon === 'hidden') return '';
  const paths = PERSONAL_INFO_ICON_SVG[icon];
  if (!paths) return '';
  return `<svg aria-hidden="true" class="${esc(iconClass)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

export function renderPersonalInfoContactItems(
  personalInfo: PersonalInfoContent,
  options: ContactHtmlOptions = {},
): string {
  const {
    itemTag = 'span',
    itemClass = 'inline-flex items-center gap-1',
    iconClass = 'h-3 w-3 shrink-0',
    valueClass = '',
  } = options;

  return getPersonalInfoExportItems(personalInfo, options)
    .map(({ key, value, icon }) => {
      const valueHtml = valueClass ? `<span class="${esc(valueClass)}">${esc(value)}</span>` : esc(value);
      return `<${itemTag} data-contact-field="${esc(key)}" class="${esc(itemClass)}">${renderPersonalInfoIcon(icon, iconClass)}${valueHtml}</${itemTag}>`;
    })
    .join('');
}

/** Join degree and field with separator */
export function degreeField(degree: string, field: string | undefined): string {
  if (!field) return degree;
  return `${degree} - ${field}`;
}

/** Lightweight markdown → HTML for resume text fields (summary, descriptions, highlights).
 *  Supports: **bold**, `code`, line breaks, and "- item" lists. */
export function md(text: unknown): string {
  if (text == null) return '';
  let s = String(text);
  // 1. Escape HTML
  s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  // 2. Bold: **text**
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // 3. Inline code: `text`
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  // 4. No newlines → return inline
  if (!s.includes('\n')) return s;
  // 5. Process lines for lists and line breaks
  const lines = s.split('\n');
  let html = '';
  let inList = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (inList) { html += '</ul>'; inList = false; }
      continue;
    }
    const lm = line.match(/^[-–•]\s+(.*)/);
    if (lm) {
      if (!inList) { html += '<ul style="margin:2px 0;padding-left:1.5em;list-style-type:disc">'; inList = true; }
      html += `<li>${lm[1]}</li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      html += (html && !html.endsWith('>') ? '<br>' : '') + line;
    }
  }
  if (inList) html += '</ul>';
  return html;
}

// ─── Section empty check ──────────────────────────────────────

type SectionWithItems = { items?: unknown[] };

export function isSectionEmpty(section: Section): boolean {
  const content = section.content;
  if (section.type === 'summary') return !(content as SummaryContent).text;
  if (section.type === 'skills') {
    const categories = (content as SkillsContent).categories;
    return !categories?.length || categories.every((cat) => !cat.skills?.length);
  }
  if (content && typeof content === 'object' && 'items' in content) return !((content as SectionWithItems).items)?.length;
  return false;
}

// ─── HTML helpers ─────────────────────────────────────────────

export function visibleSections(resume: ResumeWithSections): Section[] {
  return resume.sections.filter((s: Section) => s.visible && s.type !== 'personal_info' && !isSectionEmpty(s));
}

export function getPersonalInfo(resume: ResumeWithSections): PersonalInfoContent {
  const sec = resume.sections.find((s: Section) => s.type === 'personal_info');
  return (sec?.content || {}) as PersonalInfoContent;
}

export function buildHighlights(highlights: string[] | undefined, liClass: string, bulletStyle?: string): string {
  if (!highlights?.length) return '';
  if (bulletStyle === 'custom-dot') {
    return highlights.map(h =>
      `<li class="flex items-start gap-2 text-sm text-zinc-600"><span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style="background:linear-gradient(135deg,#7c3aed,#f97316)"></span>${md(h)}</li>`
    ).join('');
  }
  return highlights.filter(Boolean).map(h => `<li class="${liClass}">${md(h)}</li>`).join('');
}

// ─── QR codes inline HTML (SVGs pre-generated in builders.ts) ─

type QrCodesExportContent = {
  items?: QrCodeItem[];
  _qrSvgs?: Record<string, string>;
};

export function buildQrCodesHtml(section: Section): string {
  const c = section.content as QrCodesExportContent;
  const svgs = c._qrSvgs || {};
  const items = (c.items || []).filter((q) => q.url?.trim() && svgs[q.id]);
  if (items.length === 0) return '';
  return `<div class="resume-qr-list" style="display:flex;flex-wrap:wrap;justify-content:center;gap:16px 24px;padding-top:4px">${items.map((qr) =>
    `<div class="resume-qr-item" data-qr-id="${esc(qr.id)}" style="display:flex;flex-direction:column;align-items:center;gap:4px;width:96px"><div class="resume-qr-code">${svgs[qr.id]}</div><span class="resume-qr-label" style="font-size:10px;color:#6b7280;line-height:1.2;text-align:center;word-break:break-all;max-width:96px">${esc(qr.label)}</span></div>`
  ).join('')}</div>`;
}

// ─── Theme CSS for HTML export ────────────────────────────────

const FONT_SIZE_SCALE: Record<string, { body: string; h1: string; h2: string; h3: string }> = {
  small:  { body: '12px', h1: '22px', h2: '15px', h3: '13px' },
  medium: { body: '14px', h1: '26px', h2: '17px', h3: '15px' },
  large:  { body: '16px', h1: '30px', h2: '19px', h3: '17px' },
};

export const DEFAULT_THEME: ThemeConfig = {
  primaryColor: '#1a1a1a',
  accentColor: '#3b82f6',
  fontFamily: 'Inter',
  fontSize: 'medium',
  lineSpacing: 1.5,
  margin: { top: 20, right: 20, bottom: 20, left: 20 },
  sectionSpacing: 16,
  avatarStyle: 'oneInch' as const,
};

function isDark(hex: string): boolean {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b < 0.4;
}

export function buildExportThemeCSS(theme: typeof DEFAULT_THEME, template: string): string {
  const fs = FONT_SIZE_SCALE[theme.fontSize] || FONT_SIZE_SCALE.medium;
  const m = theme.margin;
  const sel = '.resume-export';
  const needsPadding = !BACKGROUND_TEMPLATES.has(template);
  const primaryIsDark = isDark(theme.primaryColor);
  const templateCustomizationCSS = buildTemplateCustomizationCSS(sel, theme);
  return `
    ${sel} > div {
      font-family: ${theme.fontFamily}, 'Noto Sans SC', sans-serif !important;
      line-height: ${theme.lineSpacing} !important;
      ${needsPadding ? `padding-top: ${m.top}px !important; padding-right: ${m.right}px !important; padding-bottom: ${m.bottom}px !important; padding-left: ${m.left}px !important;` : ''}
      --base-body-size: ${fs.body};
      --base-h1-size: ${fs.h1};
      --base-h2-size: ${fs.h2};
      --base-h3-size: ${fs.h3};
      --base-line-spacing: ${theme.lineSpacing};
      --base-section-spacing: ${theme.sectionSpacing}px;
      --base-margin-top: ${m.top}px;
      --base-margin-right: ${m.right}px;
      --base-margin-bottom: ${m.bottom}px;
      --base-margin-left: ${m.left}px;
      --needs-padding: ${needsPadding ? '1' : '0'};
    }
    ${sel} p, ${sel} li, ${sel} span, ${sel} td, ${sel} a, ${sel} div {
      font-size: ${fs.body} !important;
      line-height: ${theme.lineSpacing} !important;
    }
    ${sel} h1:not([style*="color"]) { color: ${theme.primaryColor} !important; font-size: ${fs.h1} !important; line-height: ${theme.lineSpacing} !important; }
    ${sel} h1[style*="color"] { font-size: ${fs.h1} !important; line-height: ${theme.lineSpacing} !important; }
    ${sel} h2:not([style*="color"]) { color: ${theme.accentColor} !important; font-size: ${fs.h2} !important; line-height: ${theme.lineSpacing} !important; border-color: ${theme.accentColor} !important; }
    ${sel} h2[style*="color"] { font-size: ${fs.h2} !important; line-height: ${theme.lineSpacing} !important; border-color: ${theme.accentColor} !important; }
    ${sel} h3:not([style*="color"]) { color: ${theme.primaryColor} !important; font-size: ${fs.h3} !important; line-height: ${theme.lineSpacing} !important; }
    ${sel} h3[style*="color"] { font-size: ${fs.h3} !important; line-height: ${theme.lineSpacing} !important; }
    ${sel} [class*="border-b-2"], ${sel} [class*="border-b-"] { border-color: ${theme.accentColor} !important; }
    ${sel} [class*="bg-blue-"], ${sel} [class*="bg-indigo-"],
    ${sel} [class*="bg-slate-800"], ${sel} [class*="bg-zinc-800"],
    ${sel} [class*="bg-teal-"], ${sel} [class*="bg-emerald-"] {
      background-color: ${theme.accentColor} !important;
    }
    ${sel} [data-section] { ${needsPadding ? `margin-bottom: ${theme.sectionSpacing}px` : `padding-bottom: ${theme.sectionSpacing}px`} !important; }
    ${primaryIsDark ? `
    ${sel} [style*="background"][style*="#"] h1:not([style*="color"]),
    ${sel} [style*="background"][style*="#"] h2:not([style*="color"]),
    ${sel} [style*="background"][style*="#"] h3:not([style*="color"]),
    ${sel} [style*="background"][style*="rgb"] h1:not([style*="color"]),
    ${sel} [style*="background"][style*="rgb"] h2:not([style*="color"]),
    ${sel} [style*="background"][style*="rgb"] h3:not([style*="color"]),
    ${sel} [style*="background"][style*="linear-gradient"] h1:not([style*="color"]),
    ${sel} [style*="background"][style*="linear-gradient"] h2:not([style*="color"]),
    ${sel} [style*="background"][style*="linear-gradient"] h3:not([style*="color"]),
    ${sel} .bg-black h1:not([style*="color"]),
    ${sel} .bg-black h2:not([style*="color"]),
    ${sel} .bg-black h3:not([style*="color"]) {
      color: #ffffff !important;
    }` : ''}
    ${templateCustomizationCSS}
  `;
}
