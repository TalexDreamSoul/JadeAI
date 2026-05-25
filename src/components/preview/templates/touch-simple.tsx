'use client';

import type {
  CertificationsContent,
  CustomContent,
  EducationContent,
  GitHubContent,
  LanguagesContent,
  PersonalInfoContent,
  ProjectsContent,
  QrCodesContent,
  Resume,
  SkillsContent,
  SummaryContent,
  WorkExperienceContent,
  ResumeSection,
  WorkExperienceItem,
  EducationItem,
  SkillCategory,
  ProjectItem,
  CertificationItem,
  LanguageItem,
  GitHubRepoItem,
  CustomItem,
} from '@/types/resume';
import { AvatarImage } from '../avatar-image';
import { getPersonalInfoPreviewItems } from '../personal-info-utils';
import { QrCodesPreview } from '../qr-codes-preview';
import { degreeField, isSectionEmpty, md } from '../utils';

const INK = 'var(--resume-primary-color, #18181b)';
const MUTED = '#71717a';

function dateRange(start?: string, end?: string | null, current?: boolean, lang?: string) {
  const present = lang === 'zh' ? '至今' : 'Present';
  return [start, end || (current ? present : '')].filter(Boolean).join(' - ');
}

export function TouchSimpleTemplate({ resume }: { resume: Resume }) {
  const personalInfo = resume.sections.find((s) => s.type === 'personal_info');
  const pi = (personalInfo?.content || {}) as PersonalInfoContent;
  const contacts = getPersonalInfoPreviewItems(pi, { includeJobTitle: true });

  return (
    <div className="mx-auto max-w-[210mm] bg-white shadow-lg" style={{ fontFamily: 'Inter, Arial, sans-serif', color: INK }}>
      <header className="mb-5 flex items-start justify-between gap-6 border-b border-zinc-200 pb-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">{pi.fullName || 'Your Name'}</h1>
          {contacts.length > 0 && (
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-zinc-500">
              {contacts.map(({ key, value, Icon }) => <span key={key} className="inline-flex items-center gap-1"><Icon className="h-3 w-3 shrink-0" />{value}</span>)}
            </p>
          )}
        </div>
        {pi.avatar && <AvatarImage src={pi.avatar} avatarStyle={resume.themeConfig?.avatarStyle} size={56} className="shrink-0 border border-zinc-200" />}
      </header>

      <main className="space-y-5">
        {resume.sections
          .filter((s) => s.visible && s.type !== 'personal_info' && !isSectionEmpty(s))
          .map((section) => (
            <section key={section.id} data-section data-section-id={section.id} data-section-type={section.type}>
              <h2 className="mb-2 border-b border-zinc-200 pb-1 text-[13px] font-semibold uppercase tracking-[0.16em] text-zinc-900">
                {section.title}
              </h2>
              <TouchSimpleSectionContent section={section} resume={resume} />
            </section>
          ))}
      </main>
    </div>
  );
}

function TouchSimpleSectionHeader({ title, date }: { title?: string; date?: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1">
      <div className="min-w-0 text-sm font-semibold text-zinc-900">{title}</div>
      {date && <div className="shrink-0 text-right text-xs" style={{ color: MUTED }}>{date}</div>}
    </div>
  );
}

export function TouchSimpleSectionContent({ section, resume }: { section: ResumeSection; resume: Resume }) {
  const content = section.content;
  if (!content) return null;

  if (section.type === 'summary') {
    return <p className="text-sm leading-relaxed text-zinc-700" dangerouslySetInnerHTML={{ __html: md((content as SummaryContent).text) }} />;
  }

  if (section.type === 'work_experience') {
    const items = (content as WorkExperienceContent).items || [];
    return <div className="space-y-3.5">{items.map((item: WorkExperienceItem) => <TimelineItem key={item.id} title={item.position} subtitle={[item.company, item.location].filter(Boolean).join(' · ')} date={dateRange(item.startDate, item.endDate, item.current, resume.language)} description={item.description} technologies={item.technologies} highlights={item.highlights} />)}</div>;
  }

  if (section.type === 'education') {
    const items = (content as EducationContent).items || [];
    return <div className="space-y-3">{items.map((item: EducationItem) => <TimelineItem key={item.id} title={degreeField(item.degree, item.field)} subtitle={[item.institution, item.location].filter(Boolean).join(' · ')} date={dateRange(item.startDate, item.endDate, false, resume.language)} description={item.gpa ? `GPA: ${item.gpa}` : ''} highlights={item.highlights} />)}</div>;
  }

  if (section.type === 'skills') {
    const categories = (content as SkillsContent).categories || [];
    return <div className="space-y-1.5">{categories.map((cat: SkillCategory) => <p key={cat.id} className="text-sm text-zinc-700"><span className="font-medium text-zinc-900">{cat.name}</span>{cat.name && ': '}{(cat.skills || []).join(' · ')}</p>)}</div>;
  }

  if (section.type === 'projects') {
    const items = (content as ProjectsContent).items || [];
    return <div className="space-y-3.5">{items.map((item: ProjectItem) => <TimelineItem key={item.id} title={item.name} date={dateRange(item.startDate, item.endDate, false, resume.language)} description={item.description} technologies={item.technologies} highlights={item.highlights} />)}</div>;
  }

  if (section.type === 'certifications') {
    const items = (content as CertificationsContent).items || [];
    return <div className="space-y-1.5">{items.map((item: CertificationItem) => <p key={item.id} className="text-sm text-zinc-700"><span className="font-medium text-zinc-900">{item.name}</span>{item.issuer && ` · ${item.issuer}`}{item.date && <span className="text-zinc-500"> · {item.date}</span>}</p>)}</div>;
  }

  if (section.type === 'languages') {
    const items = (content as LanguagesContent).items || [];
    return <p className="text-sm text-zinc-700">{items.map((item: LanguageItem) => `${item.language} (${item.proficiency})`).join(' · ')}</p>;
  }

  if (section.type === 'github') {
    const items = (content as GitHubContent).items || [];
    return <div className="space-y-2.5">{items.map((item: GitHubRepoItem) => <div key={item.id}><div className="flex justify-between gap-4"><span className="text-sm font-medium text-zinc-900">{item.name}</span><span className="text-xs text-zinc-500">★ {item.stars?.toLocaleString()}</span></div>{item.description && <p className="text-sm text-zinc-600" dangerouslySetInnerHTML={{ __html: md(item.description) }} />}</div>)}</div>;
  }

  if (section.type === 'custom') {
    const items = (content as CustomContent).items || [];
    return <div className="space-y-2.5">{items.map((item: CustomItem) => <TimelineItem key={item.id} title={item.title} subtitle={item.subtitle} date={item.date} description={item.description} />)}</div>;
  }

  if (section.type === 'qr_codes') return <QrCodesPreview items={(content as QrCodesContent).items || []} />;

  return null;
}

function TimelineItem({ title, subtitle, date, description, technologies, highlights }: { title?: string; subtitle?: string; date?: string; description?: string; technologies?: string[]; highlights?: string[] }) {
  return (
    <div>
      <TouchSimpleSectionHeader title={title} date={date} />
      {subtitle && <p className="mt-0.5 text-sm text-zinc-600">{subtitle}</p>}
      {description && <p className="mt-1 text-sm leading-relaxed text-zinc-600" dangerouslySetInnerHTML={{ __html: md(description) }} />}
      {technologies?.length ? <p className="mt-1 text-xs text-zinc-500">{technologies.join(' / ')}</p> : null}
      {highlights?.length ? <ul className="mt-1 list-disc space-y-0.5 pl-4">{highlights.map((h, i) => <li key={i} className="text-sm text-zinc-700" dangerouslySetInnerHTML={{ __html: md(h) }} />)}</ul> : null}
    </div>
  );
}
