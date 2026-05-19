'use client';

import type { PersonalInfoContent, Resume } from '@/types/resume';
import { isSectionEmpty } from '../utils';
import { AvatarImage } from '../avatar-image';
import { getPersonalInfoPreviewItems } from '../personal-info-utils';
import { TouchSimpleSectionContent } from './touch-simple';

const ACCENT = '#4f46e5';

export function TouchCardTemplate({ resume }: { resume: Resume }) {
  const personalInfo = resume.sections.find((s) => s.type === 'personal_info');
  const pi = (personalInfo?.content || {}) as PersonalInfoContent;
  const contacts = getPersonalInfoPreviewItems(pi, { includeJobTitle: true });

  return (
    <div className="mx-auto max-w-[210mm] bg-[#f8fafc] p-6 shadow-lg" style={{ fontFamily: 'Inter, Arial, sans-serif', color: '#111827' }}>
      <header className="mb-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70">
        <div className="flex items-start justify-between gap-5">
          <div className="min-w-0 flex-1">
            <div className="mb-2 h-1 w-10 rounded-full" style={{ backgroundColor: ACCENT }} />
            <h1 className="text-3xl font-bold tracking-tight text-zinc-950">{pi.fullName || 'Your Name'}</h1>
            {contacts.length > 0 && <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-zinc-500">{contacts.map(({ key, value, Icon }) => <span key={key} className="inline-flex items-center gap-1"><Icon className="h-3 w-3 shrink-0" />{value}</span>)}</p>}
          </div>
          {pi.avatar && <AvatarImage src={pi.avatar} avatarStyle={resume.themeConfig?.avatarStyle} size={58} className="shrink-0" />}
        </div>
      </header>

      <main className="grid gap-4">
        {resume.sections
          .filter((s) => s.visible && s.type !== 'personal_info' && !isSectionEmpty(s))
          .map((section) => (
            <section key={section.id} data-section data-section-id={section.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70">
              <div className="mb-3 flex items-center gap-2">
                <div className="h-5 w-1 rounded-full" style={{ backgroundColor: ACCENT }} />
                <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-zinc-900">{section.title}</h2>
                <div className="h-px flex-1 bg-zinc-200" />
              </div>
              <TouchSimpleSectionContent section={section} resume={resume} />
            </section>
          ))}
      </main>
    </div>
  );
}
