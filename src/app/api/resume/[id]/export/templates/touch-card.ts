import { buildTouchSimpleHtml } from './touch-simple';
import type { ResumeWithSections } from '../utils';

export function buildTouchCardHtml(resume: ResumeWithSections): string {
  return buildTouchSimpleHtml(resume)
    .replace('bg-white shadow-lg"', 'bg-[#f8fafc] p-6 shadow-lg"')
    .replace('border-b border-zinc-200 pb-4', 'rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70')
    .replace('<main class="space-y-5">', '<main class="grid gap-4">')
    .replaceAll('<section data-section>', '<section data-section class="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70">');
}
