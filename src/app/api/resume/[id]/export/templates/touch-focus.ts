import { buildTouchSimpleHtml } from './touch-simple';
import type { ResumeWithSections } from '../utils';

export function buildTouchFocusHtml(resume: ResumeWithSections): string {
  return buildTouchSimpleHtml(resume)
    .replace('border-b border-zinc-200 pb-4', 'border-l-8 pl-5')
    .replace('text-3xl font-semibold', 'text-4xl font-extrabold')
    .replaceAll('<section data-section data-section-type="', '<section data-section class="border-l-2 border-zinc-200 pl-5" data-section-type="')
    .replaceAll('border-b border-zinc-200 pb-1', '');
}
