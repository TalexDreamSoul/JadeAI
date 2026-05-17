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

const ACCENT = '#2563eb';
const MUTED = '#6b7280';

function dateRange(start?: string, end?: string | null, current?: boolean, lang?: string) {
  const present = lang === 'zh' ? '至今' : 'Present';
  return [start, end || (current ? present : '')].filter(Boolean).join(' – ');
}

function buildTouchPureSectionContent(section: Section, lang: string): string {
  const c = section.content as any;

  if (section.type === 'summary') {
    return `<div class="text-sm leading-relaxed text-zinc-700">${md((c as SummaryContent).text)}</div>`;
  }

  if (section.type === 'work_experience') {
    return `<div class="space-y-4">${((c as WorkExperienceContent).items || []).map((it: any) => `<div class="relative pl-4">
      <span class="absolute left-0 top-1.5 h-2 w-2 rounded-full" style="background-color:${ACCENT}"></span>
      <div class="flex items-baseline justify-between gap-4"><div><span class="text-sm font-semibold text-zinc-900">${esc(it.position)}</span>${it.company ? `<span class="text-sm text-zinc-700"> · ${esc(it.company)}</span>` : ''}${it.location ? `<span class="text-xs text-zinc-500"> · ${esc(it.location)}</span>` : ''}</div><span class="shrink-0 text-xs" style="color:${MUTED}">${esc(dateRange(it.startDate, it.endDate, it.current, lang))}</span></div>
      ${it.description ? `<div class="mt-1 text-sm text-zinc-600">${md(it.description)}</div>` : ''}
      ${it.technologies?.length ? `<p class="mt-1 text-xs text-zinc-500">${esc(it.technologies.join(' / '))}</p>` : ''}
      ${it.highlights?.length ? `<ul class="mt-1.5 list-disc space-y-0.5 pl-4">${buildHighlights(it.highlights, 'text-sm text-zinc-700')}</ul>` : ''}
    </div>`).join('')}</div>`;
  }

  if (section.type === 'education') {
    return `<div class="space-y-3">${((c as EducationContent).items || []).map((it: any) => `<div>
      <div class="flex items-baseline justify-between gap-4"><div><span class="text-sm font-semibold text-zinc-900">${esc(degreeField(it.degree, it.field))}</span>${it.institution ? `<span class="text-sm text-zinc-700"> · ${esc(it.institution)}</span>` : ''}${it.location ? `<span class="text-xs text-zinc-500"> · ${esc(it.location)}</span>` : ''}</div><span class="shrink-0 text-xs text-zinc-500">${esc(dateRange(it.startDate, it.endDate, false, lang))}</span></div>
      ${it.gpa ? `<p class="mt-0.5 text-xs text-zinc-500">GPA: ${esc(it.gpa)}</p>` : ''}
      ${it.highlights?.length ? `<ul class="mt-1 list-disc pl-4">${buildHighlights(it.highlights, 'text-sm text-zinc-600')}</ul>` : ''}
    </div>`).join('')}</div>`;
  }

  if (section.type === 'skills') {
    return `<div class="grid gap-2 sm:grid-cols-2">${((c as SkillsContent).categories || []).map((cat: any) => `<div class="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
      ${cat.name ? `<div class="mb-1 text-xs font-semibold text-zinc-500">${esc(cat.name)}</div>` : ''}
      <div class="flex flex-wrap gap-1.5">${(cat.skills || []).map((skill: string) => `<span class="rounded-full bg-white px-2 py-0.5 text-xs text-zinc-700 ring-1 ring-zinc-200">${esc(skill)}</span>`).join('')}</div>
    </div>`).join('')}</div>`;
  }

  if (section.type === 'projects') {
    return `<div class="space-y-4">${((c as ProjectsContent).items || []).map((it: any) => `<div>
      <div class="flex items-baseline justify-between gap-4"><span class="text-sm font-semibold text-zinc-900">${esc(it.name)}</span>${it.startDate ? `<span class="shrink-0 text-xs text-zinc-500">${esc(dateRange(it.startDate, it.endDate, false, lang))}</span>` : ''}</div>
      ${it.description ? `<div class="mt-1 text-sm text-zinc-600">${md(it.description)}</div>` : ''}
      ${it.technologies?.length ? `<p class="mt-1 text-xs text-zinc-500">${esc(it.technologies.join(' / '))}</p>` : ''}
      ${it.highlights?.length ? `<ul class="mt-1.5 list-disc space-y-0.5 pl-4">${buildHighlights(it.highlights, 'text-sm text-zinc-700')}</ul>` : ''}
    </div>`).join('')}</div>`;
  }

  if (section.type === 'certifications') {
    return `<div class="space-y-1.5">${((c as CertificationsContent).items || []).map((it: any) => `<p class="text-sm text-zinc-700"><span class="font-semibold text-zinc-900">${esc(it.name)}</span>${it.issuer ? ` · ${esc(it.issuer)}` : ''}${it.date ? `<span class="text-zinc-500"> · ${esc(it.date)}</span>` : ''}</p>`).join('')}</div>`;
  }

  if (section.type === 'languages') {
    return `<p class="text-sm text-zinc-700">${((c as LanguagesContent).items || []).map((it: any) => `${esc(it.language)} (${esc(it.proficiency)})`).join(' · ')}</p>`;
  }

  if (section.type === 'github') {
    return `<div class="space-y-3">${((c as GitHubContent).items || []).map((it: any) => `<div><div class="flex justify-between"><span class="text-sm font-semibold text-zinc-900">${esc(it.name)}</span><span class="text-xs text-zinc-500">★ ${it.stars?.toLocaleString() ?? 0}</span></div>${it.description ? `<div class="text-sm text-zinc-600">${md(it.description)}</div>` : ''}</div>`).join('')}</div>`;
  }

  if (section.type === 'custom') {
    return `<div class="space-y-2">${((c as CustomContent).items || []).map((it: any) => `<div><div class="flex justify-between"><span class="text-sm font-semibold text-zinc-900">${esc(it.title)}</span>${it.date ? `<span class="text-xs text-zinc-500">${esc(it.date)}</span>` : ''}</div>${it.subtitle ? `<p class="text-xs text-zinc-500">${esc(it.subtitle)}</p>` : ''}${it.description ? `<div class="text-sm text-zinc-600">${md(it.description)}</div>` : ''}</div>`).join('')}</div>`;
  }

  if (section.type === 'qr_codes') return buildQrCodesHtml(section);

  if (c.items) {
    return `<div class="space-y-2">${c.items.map((it: any) => `<div><span class="text-sm font-medium text-zinc-700">${esc(it.name || it.title || it.language)}</span>${it.description ? `<div class="text-sm text-zinc-600">${md(it.description)}</div>` : ''}</div>`).join('')}</div>`;
  }

  return '';
}

export function buildTouchPureHtml(resume: ResumeWithSections): string {
  const pi = getPersonalInfo(resume);
  const sections = visibleSections(resume);
  const contacts = [
    pi.email,
    pi.phone,
    pi.location,
    pi.website,
    pi.linkedin ? `LinkedIn: ${pi.linkedin}` : '',
    pi.github ? `GitHub: ${pi.github}` : '',
    pi.wechat ? `WeChat: ${pi.wechat}` : '',
    pi.yearsOfExperience,
    pi.educationLevel,
  ].filter(Boolean);

  return `<div class="mx-auto max-w-[210mm] bg-white shadow-lg" style="font-family:Inter,Arial,sans-serif;color:#111827">
    <header class="mb-6 border-b border-zinc-200 pb-5">
      <div class="flex items-start justify-between gap-5">
        <div class="min-w-0 flex-1">
          <div class="mb-2 h-1 w-12 rounded-full" style="background-color:${ACCENT}"></div>
          <h1 class="text-3xl font-semibold tracking-tight text-zinc-950">${esc(pi.fullName || 'Your Name')}</h1>
          ${pi.jobTitle ? `<p class="mt-1 text-base font-medium" style="color:${ACCENT}">${esc(pi.jobTitle)}</p>` : ''}
          ${contacts.length ? `<p class="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">${contacts.map(c => `<span>${esc(c)}</span>`).join('')}</p>` : ''}
        </div>
        ${pi.avatar ? `<img src="${esc(pi.avatar)}" alt="" class="shrink-0 border border-zinc-200 object-cover" style="width:58px;height:81px;border-radius:4px"/>` : ''}
      </div>
    </header>
    <main class="space-y-5">
      ${sections.map(s => `<section data-section>
        <div class="mb-2 flex items-center gap-2"><h2 class="text-[13px] font-bold uppercase tracking-[0.18em]" style="color:${ACCENT}">${esc(s.title)}</h2><div class="h-px flex-1 bg-zinc-200"></div></div>
        ${buildTouchPureSectionContent(s, resume.language || 'en')}
      </section>`).join('')}
    </main>
  </div>`;
}
