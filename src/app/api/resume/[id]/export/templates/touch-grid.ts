import { esc, getPersonalInfo, visibleSections, type ResumeWithSections, type Section } from '../utils';
import { buildTouchSimpleHtml } from './touch-simple';

const SIDE_TYPES = new Set(['skills', 'languages', 'certifications', 'qr_codes']);

function renderSimpleSection(resume: ResumeWithSections, section: Section): string {
  const sections = [resume.sections.find((s: Section) => s.type === 'personal_info'), section].filter(
    (s): s is Section => Boolean(s)
  );
  const single = { ...resume, sections };
  const html = buildTouchSimpleHtml(single as ResumeWithSections);
  const match = html.match(/<main class="space-y-5">([\s\S]*)<\/main>/);
  return match?.[1] || '';
}

export function buildTouchGridHtml(resume: ResumeWithSections): string {
  const pi = getPersonalInfo(resume);
  const sections = visibleSections(resume);
  const sideSections = sections.filter(s => SIDE_TYPES.has(s.type));
  const mainSections = sections.filter(s => !SIDE_TYPES.has(s.type));
  const contacts = [pi.email, pi.phone, pi.location, pi.website, pi.github].filter(Boolean);

  return `<div class="mx-auto grid max-w-[210mm] grid-cols-[32%_1fr] bg-white shadow-lg" style="font-family:Inter,Arial,sans-serif;color:#18181b">
    <aside class="bg-zinc-50 p-6 ring-1 ring-inset ring-zinc-100">
      ${pi.avatar ? `<img src="${esc(pi.avatar)}" alt="" class="mb-4 border border-zinc-200 object-cover" style="width:72px;height:101px;border-radius:4px"/>` : ''}
      <h1 class="text-2xl font-bold tracking-tight text-zinc-950">${esc(pi.fullName || 'Your Name')}</h1>
      ${pi.jobTitle ? `<p class="mt-1 text-sm font-medium text-zinc-600">${esc(pi.jobTitle)}</p>` : ''}
      ${contacts.length ? `<div class="mt-4 space-y-1 text-xs text-zinc-500">${contacts.map(c => `<p>${esc(c)}</p>`).join('')}</div>` : ''}
      <div class="mt-6 space-y-5">${sideSections.map(s => renderSimpleSection(resume, s)).join('')}</div>
    </aside>
    <main class="p-7">${mainSections.map(s => renderSimpleSection(resume, s)).join('')}</main>
  </div>`;
}
