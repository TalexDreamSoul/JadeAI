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

const ACCENT = '#0f766e';
const INK = '#111827';

function dateRange(start?: string, end?: string | null, current?: boolean, lang?: string) {
  const present = lang === 'zh' ? '至今' : 'Present';
  return [start, end || (current ? present : '')].filter(Boolean).join(' — ');
}

export function TouchFlatTemplate({ resume }: { resume: Resume }) {
  const personalInfo = resume.sections.find((s) => s.type === 'personal_info');
  const pi = (personalInfo?.content || {}) as PersonalInfoContent;
  const contacts = getPersonalInfoPreviewItems(pi, { includeJobTitle: true });

  return (
    <div className="mx-auto max-w-[210mm] bg-white shadow-lg" style={{ fontFamily: 'Inter, Arial, sans-serif', color: INK }}>
      <header className="mb-5 rounded-2xl bg-zinc-50 px-5 py-4 ring-1 ring-zinc-100">
        <div className="flex items-center justify-between gap-5">
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-950">{pi.fullName || 'Your Name'}</h1>
            {contacts.length > 0 && <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-zinc-500">{contacts.map(({ key, value, Icon }) => <span key={key} className="inline-flex items-center gap-1"><Icon className="h-3 w-3 shrink-0" />{value}</span>)}</p>}
          </div>
          {pi.avatar && <AvatarImage src={pi.avatar} avatarStyle={resume.themeConfig?.avatarStyle} size={58} className="shrink-0" />}
        </div>
      </header>

      <main className="space-y-4">
        {resume.sections
          .filter((s) => s.visible && s.type !== 'personal_info' && !isSectionEmpty(s))
          .map((section) => (
            <section key={section.id} data-section data-section-id={section.id} data-section-type={section.type} className="rounded-2xl border border-zinc-100 bg-white px-5 py-4 shadow-sm shadow-zinc-200/40">
              <div className="mb-3 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ACCENT }} />
                <h2 className="text-[13px] font-bold uppercase tracking-[0.14em]" style={{ color: ACCENT }}>{section.title}</h2>
                <div className="h-px flex-1 bg-zinc-200" />
              </div>
              <TouchFlatSectionContent section={section} resume={resume} />
            </section>
          ))}
      </main>
    </div>
  );
}

function TouchFlatSectionContent({ section, resume }: { section: any; resume: Resume }) {
  const content = section.content;
  if (!content) return null;

  if (section.type === 'summary') {
    return <p className="text-sm leading-relaxed text-zinc-700" dangerouslySetInnerHTML={{ __html: md((content as SummaryContent).text) }} />;
  }

  if (section.type === 'work_experience') {
    const items = (content as WorkExperienceContent).items || [];
    return <div className="space-y-3">{items.map((item: any) => <FlatItem key={item.id} title={item.position} subtitle={[item.company, item.location].filter(Boolean).join(' · ')} date={dateRange(item.startDate, item.endDate, item.current, resume.language)} description={item.description} technologies={item.technologies} highlights={item.highlights} />)}</div>;
  }

  if (section.type === 'education') {
    const items = (content as EducationContent).items || [];
    return <div className="space-y-3">{items.map((item: any) => <FlatItem key={item.id} title={degreeField(item.degree, item.field)} subtitle={[item.institution, item.location].filter(Boolean).join(' · ')} date={dateRange(item.startDate, item.endDate, false, resume.language)} description={item.gpa ? `GPA: ${item.gpa}` : ''} highlights={item.highlights} />)}</div>;
  }

  if (section.type === 'skills') {
    const categories = (content as SkillsContent).categories || [];
    return <div className="grid gap-2 sm:grid-cols-2">{categories.map((cat: any) => <div key={cat.id} className="rounded-xl bg-zinc-50 px-3 py-2"><div className="mb-1 text-xs font-semibold text-zinc-500">{cat.name}</div><div className="flex flex-wrap gap-1.5">{(cat.skills || []).map((skill: string, i: number) => <span key={i} className="rounded-md bg-white px-2 py-0.5 text-xs text-zinc-700 ring-1 ring-zinc-200">{skill}</span>)}</div></div>)}</div>;
  }

  if (section.type === 'projects') {
    const items = (content as ProjectsContent).items || [];
    return <div className="space-y-3">{items.map((item: any) => <FlatItem key={item.id} title={item.name} date={dateRange(item.startDate, item.endDate, false, resume.language)} description={item.description} technologies={item.technologies} highlights={item.highlights} />)}</div>;
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
    return <div className="space-y-2">{items.map((item: any) => <FlatItem key={item.id} title={item.name} date={`★ ${item.stars?.toLocaleString() ?? 0}`} description={item.description} />)}</div>;
  }

  if (section.type === 'custom') {
    const items = (content as CustomContent).items || [];
    return <div className="space-y-2">{items.map((item: any) => <FlatItem key={item.id} title={item.title} subtitle={item.subtitle} date={item.date} description={item.description} />)}</div>;
  }

  if (section.type === 'qr_codes') return <QrCodesPreview items={(content as any).items || []} />;

  return null;
}

function FlatItem({ title, subtitle, date, description, technologies, highlights }: { title?: string; subtitle?: string; date?: string; description?: string; technologies?: string[]; highlights?: string[] }) {
  return (
    <div className="rounded-xl bg-zinc-50 px-3 py-2">
      <div className="flex items-baseline justify-between gap-4">
        <div className="min-w-0">
          <span className="text-sm font-semibold text-zinc-900">{title}</span>
          {subtitle && <span className="text-sm text-zinc-600"> · {subtitle}</span>}
        </div>
        {date && <span className="shrink-0 text-xs text-zinc-500">{date}</span>}
      </div>
      {description && <p className="mt-1 text-sm leading-relaxed text-zinc-600" dangerouslySetInnerHTML={{ __html: md(description) }} />}
      {technologies?.length ? <p className="mt-1 text-xs text-zinc-500">{technologies.join(' / ')}</p> : null}
      {highlights?.length ? <ul className="mt-1 list-disc space-y-0.5 pl-4">{highlights.map((h, i) => <li key={i} className="text-sm text-zinc-700" dangerouslySetInnerHTML={{ __html: md(h) }} />)}</ul> : null}
    </div>
  );
}
