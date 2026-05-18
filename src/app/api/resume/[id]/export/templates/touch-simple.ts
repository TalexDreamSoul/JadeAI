import type {
  CertificationsContent,
  CustomContent,
  EducationContent,
  GitHubContent,
  LanguagesContent,
  ProjectsContent,
  SkillsContent,
  SummaryContent,
  WorkExperienceContent,
} from '@/types/resume';
import { buildHighlights, buildQrCodesHtml, degreeField, esc, getPersonalInfo, md, visibleSections, type ResumeWithSections, type Section } from '../utils';

const MUTED = '#71717a';

function dateRange(start?: string, end?: string | null, current?: boolean, lang?: string) {
  const present = lang === 'zh' ? '至今' : 'Present';
  return [start, end || (current ? present : '')].filter(Boolean).join(' - ');
}

function timelineItem(it: any, lang: string, title: string, subtitle = '', date = '', description = '', technologies?: string[], highlights?: string[]) {
  return `<div>
    <div class="flex items-baseline justify-between gap-4"><div class="min-w-0"><span class="text-sm font-semibold text-zinc-900">${esc(title)}</span>${subtitle ? `<span class="text-sm text-zinc-600"> · ${esc(subtitle)}</span>` : ''}</div>${date ? `<span class="shrink-0 text-xs" style="color:${MUTED}">${esc(date)}</span>` : ''}</div>
    ${description ? `<div class="mt-1 text-sm leading-relaxed text-zinc-600">${md(description)}</div>` : ''}
    ${technologies?.length ? `<p class="mt-1 text-xs text-zinc-500">${esc(technologies.join(' / '))}</p>` : ''}
    ${highlights?.length ? `<ul class="mt-1 list-disc space-y-0.5 pl-4">${buildHighlights(highlights, 'text-sm text-zinc-700')}</ul>` : ''}
  </div>`;
}

function buildSectionContent(section: Section, lang: string): string {
  const c = section.content as any;
  if (section.type === 'summary') return `<p class="text-sm leading-relaxed text-zinc-700">${md((c as SummaryContent).text)}</p>`;
  if (section.type === 'work_experience') return `<div class="space-y-3.5">${((c as WorkExperienceContent).items || []).map((it: any) => timelineItem(it, lang, it.position, [it.company, it.location].filter(Boolean).join(' · '), dateRange(it.startDate, it.endDate, it.current, lang), it.description, it.technologies, it.highlights)).join('')}</div>`;
  if (section.type === 'education') return `<div class="space-y-3">${((c as EducationContent).items || []).map((it: any) => timelineItem(it, lang, degreeField(it.degree, it.field), [it.institution, it.location].filter(Boolean).join(' · '), dateRange(it.startDate, it.endDate, false, lang), it.gpa ? `GPA: ${it.gpa}` : '', undefined, it.highlights)).join('')}</div>`;
  if (section.type === 'skills') return `<div class="space-y-1.5">${((c as SkillsContent).categories || []).map((cat: any) => `<p class="text-sm text-zinc-700"><span class="font-medium text-zinc-900">${esc(cat.name)}</span>${cat.name ? ': ' : ''}${esc((cat.skills || []).join(' · '))}</p>`).join('')}</div>`;
  if (section.type === 'projects') return `<div class="space-y-3.5">${((c as ProjectsContent).items || []).map((it: any) => timelineItem(it, lang, it.name, '', dateRange(it.startDate, it.endDate, false, lang), it.description, it.technologies, it.highlights)).join('')}</div>`;
  if (section.type === 'certifications') return `<div class="space-y-1.5">${((c as CertificationsContent).items || []).map((it: any) => `<p class="text-sm text-zinc-700"><span class="font-medium text-zinc-900">${esc(it.name)}</span>${it.issuer ? ` · ${esc(it.issuer)}` : ''}${it.date ? `<span class="text-zinc-500"> · ${esc(it.date)}</span>` : ''}</p>`).join('')}</div>`;
  if (section.type === 'languages') return `<p class="text-sm text-zinc-700">${((c as LanguagesContent).items || []).map((it: any) => `${esc(it.language)} (${esc(it.proficiency)})`).join(' · ')}</p>`;
  if (section.type === 'github') return `<div class="space-y-2.5">${((c as GitHubContent).items || []).map((it: any) => `<div><div class="flex justify-between gap-4"><span class="text-sm font-medium text-zinc-900">${esc(it.name)}</span><span class="text-xs text-zinc-500">★ ${it.stars?.toLocaleString() ?? 0}</span></div>${it.description ? `<div class="text-sm text-zinc-600">${md(it.description)}</div>` : ''}</div>`).join('')}</div>`;
  if (section.type === 'custom') return `<div class="space-y-2.5">${((c as CustomContent).items || []).map((it: any) => timelineItem(it, lang, it.title, it.subtitle, it.date, it.description)).join('')}</div>`;
  if (section.type === 'qr_codes') return buildQrCodesHtml(section);
  return '';
}

export function buildTouchSimpleHtml(resume: ResumeWithSections): string {
  const pi = getPersonalInfo(resume);
  const sections = visibleSections(resume);
  const contacts = [pi.jobTitle, pi.email, pi.phone, pi.location, pi.website].filter(Boolean);

  return `<div class="mx-auto max-w-[210mm] bg-white shadow-lg" style="font-family:Inter,Arial,sans-serif;color:#18181b">
    <header class="mb-5 flex items-start justify-between gap-6 border-b border-zinc-200 pb-4">
      <div class="min-w-0 flex-1"><h1 class="text-3xl font-semibold tracking-tight text-zinc-950">${esc(pi.fullName || 'Your Name')}</h1>${contacts.length ? `<p class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-zinc-500">${contacts.map(c => `<span>${esc(c)}</span>`).join('')}</p>` : ''}</div>
      ${pi.avatar ? `<img src="${esc(pi.avatar)}" alt="" class="shrink-0 border border-zinc-200 object-cover" style="width:56px;height:78px;border-radius:4px"/>` : ''}
    </header>
    <main class="space-y-5">${sections.map(s => `<section data-section><h2 class="mb-2 border-b border-zinc-200 pb-1 text-[13px] font-semibold uppercase tracking-[0.16em] text-zinc-900">${esc(s.title)}</h2>${buildSectionContent(s, resume.language || 'en')}</section>`).join('')}</main>
  </div>`;
}
