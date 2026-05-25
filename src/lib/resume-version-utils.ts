import type { Resume, ResumeSection } from '@/types/resume';

function textOf(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function recordsOf(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function stringsOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function resumeSectionPlainText(section: Pick<ResumeSection, 'type' | 'title' | 'content'>): string {
  const content = asRecord(section.content);
  if (section.type === 'summary') return textOf(content.text);
  if (section.type === 'skills') {
    return recordsOf(content.categories)
      .map((category) => [textOf(category.name), stringsOf(category.skills).join(', ')].filter(Boolean).join(': '))
      .join('\n');
  }
  if (section.type === 'work_experience') {
    return recordsOf(content.items).map((item) => [
      textOf(item.position),
      textOf(item.company),
      textOf(item.location),
      textOf(item.description),
      stringsOf(item.technologies).join(', '),
      stringsOf(item.highlights).join('\n'),
    ].filter(Boolean).join('\n')).join('\n\n');
  }
  if (section.type === 'projects') {
    return recordsOf(content.items).map((item) => [
      textOf(item.name),
      textOf(item.description),
      stringsOf(item.technologies).join(', '),
      stringsOf(item.highlights).join('\n'),
    ].filter(Boolean).join('\n')).join('\n\n');
  }
  if (section.type === 'education') {
    return recordsOf(content.items).map((item) => [
      textOf(item.institution),
      textOf(item.degree),
      textOf(item.field),
      textOf(item.gpa),
      stringsOf(item.highlights).join('\n'),
    ].filter(Boolean).join('\n')).join('\n\n');
  }
  if ('items' in content) {
    return recordsOf(content.items).map((item) => [
      textOf(item.name || item.title || item.language),
      textOf(item.subtitle || item.issuer || item.proficiency),
      textOf(item.description),
    ].filter(Boolean).join('\n')).join('\n\n');
  }
  return textOf(content);
}

function compact(value: string, max = 240) {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function comparableSection(section: ResumeSection) {
  return {
    type: section.type,
    title: section.title,
    visible: section.visible,
    sortOrder: section.sortOrder,
    content: section.content,
  };
}

export type ResumeVersionDiff = {
  metadataChanged: Array<{ key: string; before: unknown; after: unknown }>;
  sectionChanges: Array<{
    sectionId: string;
    sectionType?: string;
    sectionTitle?: string;
    changeType: 'added' | 'removed' | 'changed';
    titleChanged?: boolean;
    visibleChanged?: boolean;
    sortOrderChanged?: boolean;
    contentChanged?: boolean;
    beforeText?: string;
    afterText?: string;
  }>;
  summary: {
    metadataCount: number;
    added: number;
    removed: number;
    changed: number;
  };
};

export function diffResumes(before: Resume, after: Resume): ResumeVersionDiff {
  const beforeSections = Array.isArray(before.sections) ? before.sections : [];
  const afterSections = Array.isArray(after.sections) ? after.sections : [];
  const beforeById = new Map(beforeSections.map((section) => [section.id, section]));
  const afterById = new Map(afterSections.map((section) => [section.id, section]));
  const sectionIds = new Set([...beforeById.keys(), ...afterById.keys()].filter(Boolean));

  const sectionChanges = Array.from(sectionIds).map((id) => {
    const oldSection = beforeById.get(id);
    const newSection = afterById.get(id);
    if (!oldSection && newSection) {
      return {
        sectionId: id,
        sectionType: newSection.type,
        sectionTitle: newSection.title,
        changeType: 'added' as const,
        afterText: compact(resumeSectionPlainText(newSection)),
      };
    }
    if (oldSection && !newSection) {
      return {
        sectionId: id,
        sectionType: oldSection.type,
        sectionTitle: oldSection.title,
        changeType: 'removed' as const,
        beforeText: compact(resumeSectionPlainText(oldSection)),
      };
    }
    if (!oldSection || !newSection) return null;
    if (JSON.stringify(comparableSection(oldSection)) === JSON.stringify(comparableSection(newSection))) return null;
    return {
      sectionId: id,
      sectionType: newSection.type || oldSection.type,
      sectionTitle: newSection.title || oldSection.title,
      changeType: 'changed' as const,
      titleChanged: oldSection.title !== newSection.title,
      visibleChanged: oldSection.visible !== newSection.visible,
      sortOrderChanged: oldSection.sortOrder !== newSection.sortOrder,
      contentChanged: JSON.stringify(oldSection.content) !== JSON.stringify(newSection.content),
      beforeText: compact(resumeSectionPlainText(oldSection)),
      afterText: compact(resumeSectionPlainText(newSection)),
    };
  }).filter((item): item is NonNullable<typeof item> => !!item);

  const metadataChanged = ['title', 'template', 'language', 'targetCompany', 'targetJobTitle', 'versionLabel']
    .filter((key) => JSON.stringify((before as unknown as Record<string, unknown>)[key]) !== JSON.stringify((after as unknown as Record<string, unknown>)[key]))
    .map((key) => ({
      key,
      before: (before as unknown as Record<string, unknown>)[key],
      after: (after as unknown as Record<string, unknown>)[key],
    }));

  return {
    metadataChanged,
    sectionChanges,
    summary: {
      metadataCount: metadataChanged.length,
      added: sectionChanges.filter((item) => item.changeType === 'added').length,
      removed: sectionChanges.filter((item) => item.changeType === 'removed').length,
      changed: sectionChanges.filter((item) => item.changeType === 'changed').length,
    },
  };
}
