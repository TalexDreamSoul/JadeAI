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
  ResumeSection,
  WorkExperienceItem,
  EducationItem,
  SkillCategory,
  ProjectItem,
  CertificationItem,
  LanguageItem,
  GitHubRepoItem,
  CustomItem,
} from '@/types/resume';
import { buildHighlights, buildQrCodesHtml, degreeField, esc, getPersonalInfo, md, visibleSections, type ResumeWithSections, type Section } from '../utils';

const ACCENT = 'var(--resume-accent-color,#0f766e)';

function dateRange(start?: string, end?: string | null, current?: boolean, lang?: string) {
  const present = lang === 'zh' ? '至今' : 'Present';
  return [start, end || (current ? present : '')].filter(Boolean).join(' — ');
}

function flatItem(title: string, subtitle = '', date = '', description = '', technologies?: string[], highlights?: string[]) {
  return `<div class="rounded-xl bg-zinc-50 px-3 py-2">
    <div class="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1"><div class="min-w-0 text-sm font-semibold text-zinc-900">${esc(title)}</div>${date ? `<div class="shrink-0 text-right text-xs text-zinc-500">${esc(date)}</div>` : ''}</div>
    ${subtitle ? `<p class="mt-0.5 text-sm text-zinc-600">${esc(subtitle)}</p>` : ''}
    ${description ? `<div class="mt-1 text-sm leading-relaxed text-zinc-600">${md(description)}</div>` : ''}
    ${technologies?.length ? `<p class="mt-1 text-xs text-zinc-500">${esc(technologies.join(' / '))}</p>` : ''}
    ${highlights?.length ? `<ul class="mt-1 list-disc space-y-0.5 pl-4">${buildHighlights(highlights, 'text-sm text-zinc-700')}</ul>` : ''}
  </div>`;
}

function buildSectionContent(section: Section, lang: string): string {
  const c = section.content as ResumeSection['content'];
  if (section.type === 'summary') return `<p class="text-sm leading-relaxed text-zinc-700">${md((c as SummaryContent).text)}</p>`;
  if (section.type === 'work_experience') return `<div class="space-y-3">${((c as WorkExperienceContent).items || []).map((it: WorkExperienceItem) => flatItem(it.position, [it.company, it.location].filter(Boolean).join(' · '), dateRange(it.startDate, it.endDate, it.current, lang), it.description, it.technologies, it.highlights)).join('')}</div>`;
  if (section.type === 'education') return `<div class="space-y-3">${((c as EducationContent).items || []).map((it: EducationItem) => flatItem(degreeField(it.degree, it.field), [it.institution, it.location].filter(Boolean).join(' · '), dateRange(it.startDate, it.endDate, false, lang), it.gpa ? `GPA: ${it.gpa}` : '', undefined, it.highlights)).join('')}</div>`;
  if (section.type === 'skills') return `<div class="grid gap-2 sm:grid-cols-2">${((c as SkillsContent).categories || []).map((cat: SkillCategory) => `<div class="rounded-xl bg-zinc-50 px-3 py-2"><div class="mb-1 text-xs font-semibold text-zinc-500">${esc(cat.name)}</div><div class="flex flex-wrap gap-1.5">${(cat.skills || []).map((skill: string) => `<span class="rounded-md bg-white px-2 py-0.5 text-xs text-zinc-700 ring-1 ring-zinc-200">${esc(skill)}</span>`).join('')}</div></div>`).join('')}</div>`;
  if (section.type === 'projects') return `<div class="space-y-3">${((c as ProjectsContent).items || []).map((it: ProjectItem) => flatItem(it.name, '', dateRange(it.startDate, it.endDate, false, lang), it.description, it.technologies, it.highlights)).join('')}</div>`;
  if (section.type === 'certifications') return `<div class="space-y-1.5">${((c as CertificationsContent).items || []).map((it: CertificationItem) => `<p class="text-sm text-zinc-700"><span class="font-semibold text-zinc-900">${esc(it.name)}</span>${it.issuer ? ` · ${esc(it.issuer)}` : ''}${it.date ? `<span class="text-zinc-500"> · ${esc(it.date)}</span>` : ''}</p>`).join('')}</div>`;
  if (section.type === 'languages') return `<p class="text-sm text-zinc-700">${((c as LanguagesContent).items || []).map((it: LanguageItem) => `${esc(it.language)} (${esc(it.proficiency)})`).join(' · ')}</p>`;
  if (section.type === 'github') return `<div class="space-y-2">${((c as GitHubContent).items || []).map((it: GitHubRepoItem) => flatItem(it.name, '', `★ ${it.stars?.toLocaleString() ?? 0}`, it.description)).join('')}</div>`;
  if (section.type === 'custom') return `<div class="space-y-2">${((c as CustomContent).items || []).map((it: CustomItem) => flatItem(it.title, it.subtitle, it.date, it.description)).join('')}</div>`;
  if (section.type === 'qr_codes') return buildQrCodesHtml(section);
  return '';
}

export function buildTouchFlatHtml(resume: ResumeWithSections): string {
  const pi = getPersonalInfo(resume);
  const sections = visibleSections(resume);
  const contacts = [pi.jobTitle, pi.email, pi.phone, pi.location, pi.website, pi.github].filter(Boolean);
  return `<div class="mx-auto max-w-[210mm] bg-white shadow-lg" style="font-family:Inter,Arial,sans-serif;color:#111827">
    <header class="mb-5 rounded-2xl bg-zinc-50 px-5 py-4 ring-1 ring-zinc-100"><div class="flex items-center justify-between gap-5"><div class="min-w-0 flex-1"><h1 class="text-3xl font-bold tracking-tight text-zinc-950">${esc(pi.fullName || 'Your Name')}</h1>${contacts.length ? `<p class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-zinc-500">${contacts.map(c => `<span>${esc(c)}</span>`).join('')}</p>` : ''}</div>${pi.avatar ? `<img src="${esc(pi.avatar)}" alt="" class="shrink-0 object-cover" style="width:58px;height:81px;border-radius:4px"/>` : ''}</div></header>
    <main class="space-y-4">${sections.map(s => `<section data-section data-section-type="${esc(s.type)}" class="rounded-2xl border border-zinc-100 bg-white px-5 py-4 shadow-sm shadow-zinc-200/40"><div class="mb-3 flex items-center gap-2"><span class="h-2 w-2 rounded-full" style="background-color:${ACCENT}"></span><h2 class="text-[13px] font-bold uppercase tracking-[0.14em]" style="color:${ACCENT}">${esc(s.title)}</h2><div class="h-px flex-1 bg-zinc-200"></div></div>${buildSectionContent(s, resume.language || 'en')}</section>`).join('')}</main>
  </div>`;
}
