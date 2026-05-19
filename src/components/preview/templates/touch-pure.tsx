'use client';

import type {
  CertificationsContent,
  CustomContent,
  EducationContent,
  GitHubContent,
  LanguagesContent,
  PersonalInfoContent,
  ProjectsContent,
  Resume,
  SkillsContent,
  SummaryContent,
  WorkExperienceContent,
} from '@/types/resume';
import { AvatarImage } from '../avatar-image';
import { getPersonalInfoPreviewItems } from '../personal-info-utils';
import { QrCodesPreview } from '../qr-codes-preview';
import { degreeField, isSectionEmpty, md } from '../utils';

const ACCENT = '#2563eb';
const INK = '#111827';
const MUTED = '#6b7280';

function dateRange(start?: string, end?: string | null, current?: boolean, lang?: string) {
  const present = lang === 'zh' ? '至今' : 'Present';
  return [start, end || (current ? present : '')].filter(Boolean).join(' – ');
}

export function TouchPureTemplate({ resume }: { resume: Resume }) {
  const personalInfo = resume.sections.find((s) => s.type === 'personal_info');
  const pi = (personalInfo?.content || {}) as PersonalInfoContent;
  const contacts = getPersonalInfoPreviewItems(pi);

  return (
    <div className="mx-auto max-w-[210mm] bg-white shadow-lg" style={{ fontFamily: 'Inter, Arial, sans-serif', color: INK }}>
      <header className="mb-6 border-b border-zinc-200 pb-5">
        <div className="flex items-start justify-between gap-5">
          <div className="min-w-0 flex-1">
            <div className="mb-2 h-1 w-12 rounded-full" style={{ backgroundColor: ACCENT }} />
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">{pi.fullName || 'Your Name'}</h1>
            {pi.jobTitle && <p className="mt-1 text-base font-medium" style={{ color: ACCENT }}>{pi.jobTitle}</p>}
            {contacts.length > 0 && (
              <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
                {contacts.map(({ key, value, Icon }) => <span key={key} className="inline-flex items-center gap-1"><Icon className="h-3 w-3 shrink-0" />{value}</span>)}
              </p>
            )}
          </div>
          {pi.avatar && (
            <AvatarImage
              src={pi.avatar}
              avatarStyle={resume.themeConfig?.avatarStyle}
              size={58}
              className="shrink-0 border border-zinc-200"
            />
          )}
        </div>
      </header>

      <main className="space-y-5">
        {resume.sections
          .filter((s) => s.visible && s.type !== 'personal_info' && !isSectionEmpty(s))
          .map((section) => (
            <section key={section.id} data-section data-section-id={section.id}>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-[13px] font-bold uppercase tracking-[0.18em]" style={{ color: ACCENT }}>
                  {section.title}
                </h2>
                <div className="h-px flex-1 bg-zinc-200" />
              </div>
              <TouchPureSectionContent section={section} resume={resume} />
            </section>
          ))}
      </main>
    </div>
  );
}

export function TouchPureSectionContent({ section, resume }: { section: any; resume: Resume }) {
  const content = section.content;
  if (!content) return null;

  if (section.type === 'summary') {
    return <p className="text-sm leading-relaxed text-zinc-700" dangerouslySetInnerHTML={{ __html: md((content as SummaryContent).text) }} />;
  }

  if (section.type === 'work_experience') {
    const items = (content as WorkExperienceContent).items || [];
    return (
      <div className="space-y-4">
        {items.map((item: any) => (
          <div key={item.id} className="relative pl-4">
            <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full" style={{ backgroundColor: ACCENT }} />
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <span className="text-sm font-semibold text-zinc-900">{item.position}</span>
                {item.company && <span className="text-sm text-zinc-700"> · {item.company}</span>}
                {item.location && <span className="text-xs text-zinc-500"> · {item.location}</span>}
              </div>
              <span className="shrink-0 text-xs" style={{ color: MUTED }}>{dateRange(item.startDate, item.endDate, item.current, resume.language)}</span>
            </div>
            {item.description && <p className="mt-1 text-sm text-zinc-600" dangerouslySetInnerHTML={{ __html: md(item.description) }} />}
            {item.technologies?.length > 0 && <p className="mt-1 text-xs text-zinc-500">{item.technologies.join(' / ')}</p>}
            {item.highlights?.length > 0 && (
              <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
                {item.highlights.map((h: string, i: number) => <li key={i} className="text-sm text-zinc-700" dangerouslySetInnerHTML={{ __html: md(h) }} />)}
              </ul>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (section.type === 'education') {
    const items = (content as EducationContent).items || [];
    return (
      <div className="space-y-3">
        {items.map((item: any) => (
          <div key={item.id}>
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <span className="text-sm font-semibold text-zinc-900">{degreeField(item.degree, item.field)}</span>
                {item.institution && <span className="text-sm text-zinc-700"> · {item.institution}</span>}
                {item.location && <span className="text-xs text-zinc-500"> · {item.location}</span>}
              </div>
              <span className="shrink-0 text-xs text-zinc-500">{dateRange(item.startDate, item.endDate, false, resume.language)}</span>
            </div>
            {item.gpa && <p className="mt-0.5 text-xs text-zinc-500">GPA: {item.gpa}</p>}
            {item.highlights?.length > 0 && (
              <ul className="mt-1 list-disc pl-4">
                {item.highlights.map((h: string, i: number) => <li key={i} className="text-sm text-zinc-600" dangerouslySetInnerHTML={{ __html: md(h) }} />)}
              </ul>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (section.type === 'skills') {
    const categories = (content as SkillsContent).categories || [];
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {categories.map((cat: any) => (
          <div key={cat.id} className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
            {cat.name && <div className="mb-1 text-xs font-semibold text-zinc-500">{cat.name}</div>}
            <div className="flex flex-wrap gap-1.5">
              {(cat.skills || []).map((skill: string, i: number) => (
                <span key={i} className="rounded-full bg-white px-2 py-0.5 text-xs text-zinc-700 ring-1 ring-zinc-200">{skill}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (section.type === 'projects') {
    const items = (content as ProjectsContent).items || [];
    return (
      <div className="space-y-4">
        {items.map((item: any) => (
          <div key={item.id}>
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm font-semibold text-zinc-900">{item.name}</span>
              {item.startDate && <span className="shrink-0 text-xs text-zinc-500">{dateRange(item.startDate, item.endDate, false, resume.language)}</span>}
            </div>
            {item.description && <p className="mt-1 text-sm text-zinc-600" dangerouslySetInnerHTML={{ __html: md(item.description) }} />}
            {item.technologies?.length > 0 && <p className="mt-1 text-xs text-zinc-500">{item.technologies.join(' / ')}</p>}
            {item.highlights?.length > 0 && (
              <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
                {item.highlights.map((h: string, i: number) => <li key={i} className="text-sm text-zinc-700" dangerouslySetInnerHTML={{ __html: md(h) }} />)}
              </ul>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (section.type === 'certifications') {
    const items = (content as CertificationsContent).items || [];
    return <div className="space-y-1.5">{items.map((item: any) => <p key={item.id} className="text-sm text-zinc-700"><span className="font-semibold text-zinc-900">{item.name}</span>{item.issuer && ` · ${item.issuer}`}{item.date && <span className="text-zinc-500"> · {item.date}</span>}</p>)}</div>;
  }

  if (section.type === 'languages') {
    const items = (content as LanguagesContent).items || [];
    return <p className="text-sm text-zinc-700">{items.map((item: any) => `${item.language} (${item.proficiency})`).join(' · ')}</p>;
  }

  if (section.type === 'github') {
    const items = (content as GitHubContent).items || [];
    return <div className="space-y-3">{items.map((item: any) => <div key={item.id}><div className="flex justify-between"><span className="text-sm font-semibold text-zinc-900">{item.name}</span><span className="text-xs text-zinc-500">★ {item.stars?.toLocaleString()}</span></div>{item.description && <p className="text-sm text-zinc-600" dangerouslySetInnerHTML={{ __html: md(item.description) }} />}</div>)}</div>;
  }

  if (section.type === 'custom') {
    const items = (content as CustomContent).items || [];
    return <div className="space-y-2">{items.map((item: any) => <div key={item.id}><div className="flex justify-between"><span className="text-sm font-semibold text-zinc-900">{item.title}</span>{item.date && <span className="text-xs text-zinc-500">{item.date}</span>}</div>{item.subtitle && <p className="text-xs text-zinc-500">{item.subtitle}</p>}{item.description && <p className="text-sm text-zinc-600" dangerouslySetInnerHTML={{ __html: md(item.description) }} />}</div>)}</div>;
  }

  if (section.type === 'qr_codes') return <QrCodesPreview items={(content as any).items || []} />;

  if (content?.items) {
    return <div className="space-y-2">{content.items.map((item: any) => <div key={item.id}><span className="text-sm font-medium text-zinc-700">{item.name || item.title || item.language}</span>{item.description && <p className="text-sm text-zinc-600" dangerouslySetInnerHTML={{ __html: md(item.description) }} />}</div>)}</div>;
  }

  return null;
}
