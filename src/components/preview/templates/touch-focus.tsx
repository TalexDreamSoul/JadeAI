'use client';

import type { PersonalInfoContent, Resume } from '@/types/resume';
import { isSectionEmpty } from '../utils';
import { AvatarImage } from '../avatar-image';
import { getPersonalInfoPreviewItems } from '../personal-info-utils';
import { TouchSimpleSectionContent } from './touch-simple';

const ACCENT = '#ea580c';

export function TouchFocusTemplate({ resume }: { resume: Resume }) {
  const personalInfo = resume.sections.find((s) => s.type === 'personal_info');
  const pi = (personalInfo?.content || {}) as PersonalInfoContent;
  const contacts = getPersonalInfoPreviewItems(pi, { includeJobTitle: true });

  return (
    <div className="mx-auto max-w-[210mm] bg-white shadow-lg" style={{ fontFamily: 'Inter, Arial, sans-serif', color: '#111827' }}>
      <header className="mb-6 border-l-8 pl-5" style={{ borderColor: ACCENT }}>
        <div className="flex items-start justify-between gap-5">
          <div className="min-w-0 flex-1">
            <h1 className="text-4xl font-extrabold tracking-tight text-zinc-950">{pi.fullName || 'Your Name'}</h1>
            {contacts.length > 0 && <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-zinc-500">{contacts.map(({ key, value, Icon }) => <span key={key} className="inline-flex items-center gap-1"><Icon className="h-3 w-3 shrink-0" />{value}</span>)}</p>}
          </div>
          {pi.avatar && <AvatarImage src={pi.avatar} avatarStyle={resume.themeConfig?.avatarStyle} size={60} className="shrink-0 border border-zinc-200" />}
        </div>
      </header>

      <main className="space-y-5">
        {resume.sections
          .filter((s) => s.visible && s.type !== 'personal_info' && !isSectionEmpty(s))
          .map((section) => (
            <section key={section.id} data-section data-section-id={section.id} className="border-l-2 border-zinc-200 pl-5">
              <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-[0.16em]" style={{ color: ACCENT }}>{section.title}</h2>
              <TouchSimpleSectionContent section={section} resume={resume} />
            </section>
          ))}
      </main>
    </div>
  );
}
