import { esc, getPersonalInfo, visibleSections, type ResumeWithSections } from '../utils';
import { buildTouchSimpleHtml } from './touch-simple';

export function buildTouchCompactHtml(resume: ResumeWithSections): string {
  // Compact uses the same semantic layout as TouchSimple; global theme CSS controls density.
  const pi = getPersonalInfo(resume);
  const html = buildTouchSimpleHtml(resume)
    .replace('text-3xl font-semibold', 'text-2xl font-bold')
    .replace('space-y-5', 'space-y-3.5')
    .replace('mb-5 flex', 'mb-4 flex')
    .replace('pb-4', 'pb-3')
    .replace('text-sm text-zinc-500', 'text-xs text-zinc-500');
  return html || `<div>${esc(pi.fullName || 'Your Name')}</div>`;
}
