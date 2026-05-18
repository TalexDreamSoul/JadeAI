import { buildTouchSimpleHtml } from './touch-simple';
import type { ResumeWithSections } from '../utils';

export function buildTouchFocusHtml(resume: ResumeWithSections): string {
  return buildTouchSimpleHtml(resume)
    .replace('border-b border-zinc-200 pb-4', 'border-l-8 border-orange-600 pl-5')
    .replace('text-3xl font-semibold', 'text-4xl font-extrabold')
    .replaceAll('<section data-section>', '<section data-section class="border-l-2 border-zinc-200 pl-5">')
    .replaceAll('border-b border-zinc-200 pb-1', '');
}
