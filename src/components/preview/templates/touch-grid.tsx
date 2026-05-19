'use client';

import type { PersonalInfoContent, Resume } from '@/types/resume';
import { isSectionEmpty } from '../utils';
import { AvatarImage } from '../avatar-image';
import { getPersonalInfoPreviewItems } from '../personal-info-utils';
import { TouchSimpleSectionContent } from './touch-simple';

const SIDE_TYPES = new Set(['skills', 'languages', 'certifications', 'qr_codes']);

export function TouchGridTemplate({ resume }: { resume: Resume }) {
  const personalInfo = resume.sections.find((s) => s.type === 'personal_info');
  const pi = (personalInfo?.content || {}) as PersonalInfoContent;
  const sections = resume.sections.filter((s) => s.visible && s.type !== 'personal_info' && !isSectionEmpty(s));
  const sideSections = sections.filter((s) => SIDE_TYPES.has(s.type));
  const mainSections = sections.filter((s) => !SIDE_TYPES.has(s.type));
  const contacts = getPersonalInfoPreviewItems(pi);

  const renderSection = (section: any, compact = false) => (
    <section key={section.id} data-section data-section-id={section.id} className={compact ? '' : 'mb-5'}>
      <h2 className="mb-2 border-b border-zinc-200 pb-1 text-[12px] font-bold uppercase tracking-[0.16em] text-zinc-900">{section.title}</h2>
      <TouchSimpleSectionContent section={section} resume={resume} />
    </section>
  );

  return (
    <div className="mx-auto grid max-w-[210mm] grid-cols-[32%_1fr] bg-white shadow-lg" style={{ fontFamily: 'Inter, Arial, sans-serif', color: '#18181b' }}>
      <aside className="bg-zinc-50 p-6 ring-1 ring-inset ring-zinc-100">
        {pi.avatar && <AvatarImage src={pi.avatar} avatarStyle={resume.themeConfig?.avatarStyle} size={72} className="mb-4 border border-zinc-200" />}
        <h1 className="text-2xl font-bold tracking-tight text-zinc-950">{pi.fullName || 'Your Name'}</h1>
        {pi.jobTitle && <p className="mt-1 text-sm font-medium text-zinc-600">{pi.jobTitle}</p>}
        {contacts.length > 0 && <div className="mt-4 space-y-1 text-xs text-zinc-500">{contacts.map(({ key, value, Icon }) => <p key={key} className="flex items-center gap-1.5"><Icon className="h-3 w-3 shrink-0" /><span className="break-all">{value}</span></p>)}</div>}
        <div className="mt-6 space-y-5">{sideSections.map((s) => renderSection(s, true))}</div>
      </aside>
      <main className="p-7">{mainSections.map((s) => renderSection(s))}</main>
    </div>
  );
}
