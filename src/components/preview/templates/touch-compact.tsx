'use client';

import type { PersonalInfoContent, Resume } from '@/types/resume';
import { isSectionEmpty } from '../utils';
import { AvatarImage } from '../avatar-image';
import { getPersonalInfoPreviewItems } from '../personal-info-utils';
import { TouchSimpleSectionContent } from './touch-simple';

export function TouchCompactTemplate({ resume }: { resume: Resume }) {
  const personalInfo = resume.sections.find((s) => s.type === 'personal_info');
  const pi = (personalInfo?.content || {}) as PersonalInfoContent;
  const contacts = getPersonalInfoPreviewItems(pi, { includeJobTitle: true });

  return (
    <div className="mx-auto max-w-[210mm] bg-white shadow-lg" style={{ fontFamily: 'Inter, Arial, sans-serif', color: '#18181b' }}>
      <header className="mb-4 flex items-start justify-between gap-4 border-b border-zinc-300 pb-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">{pi.fullName || 'Your Name'}</h1>
          {contacts.length > 0 && <p className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-zinc-500">{contacts.map(({ key, value, Icon }) => <span key={key} className="inline-flex items-center gap-1"><Icon className="h-3 w-3 shrink-0" />{value}</span>)}</p>}
        </div>
        {pi.avatar && <AvatarImage src={pi.avatar} avatarStyle={resume.themeConfig?.avatarStyle} size={46} className="shrink-0 border border-zinc-200" />}
      </header>

      <main className="space-y-3.5">
        {resume.sections
          .filter((s) => s.visible && s.type !== 'personal_info' && !isSectionEmpty(s))
          .map((section) => (
            <section key={section.id} data-section data-section-id={section.id} data-section-type={section.type}>
              <h2 className="mb-1.5 border-b border-zinc-200 pb-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-700">
                {section.title}
              </h2>
              <div className="text-[12px]">
                <TouchSimpleSectionContent section={section} resume={resume} />
              </div>
            </section>
          ))}
      </main>
    </div>
  );
}
