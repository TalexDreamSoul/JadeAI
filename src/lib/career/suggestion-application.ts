import type { ApplicableSuggestion } from '../ai/jd-analysis-schema';
import type { ResumeSection } from '../../types/resume';

type ResumeWithSections = {
  language?: string | null;
  sections: unknown[];
};

type MutableSectionContent = Record<string, unknown>;
type SkillCategoryDraft = {
  id?: string;
  name?: string;
  skills?: string[];
};
type HighlightItemDraft = {
  description?: unknown;
  highlights?: string[];
  [key: string]: unknown;
};

export type SuggestionUpdate = {
  section: ResumeSection;
  previousContent: unknown;
  nextContent: unknown;
};

function splitKeywords(value: string): string[] {
  return value
    .split(/[,，、;；\n]/)
    .map((item) => item.trim().replace(/^[-*]\s*/, ''))
    .filter(Boolean)
    .slice(0, 12);
}

function appendUnique(values: string[], additions: string[]): string[] {
  const seen = new Set(values.map((value) => value.toLowerCase()));
  const next = [...values];
  for (const item of additions) {
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      next.push(item);
    }
  }
  return next;
}

function compactText(value: string) {
  return value
    .replace(/[：]/g, ':')
    .replace(/[，]/g, ',')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();
}

function textMatches(source: unknown, target: string) {
  if (typeof source !== 'string') return false;
  const a = compactText(source);
  const b = compactText(target);
  return a === b || (!!b && a.includes(b)) || (!!a && b.includes(a));
}

function replaceFirstMatchingText(values: string[], current: string, suggested: string) {
  let replaced = false;
  const next = values.map((value) => {
    if (!replaced && textMatches(value, current)) {
      replaced = true;
      return suggested;
    }
    return value;
  });
  return { next, replaced };
}

function parseCategoryLine(value: string) {
  const match = value.match(/^\s*([^:：]+)[:：]\s*([\s\S]+)$/);
  if (!match) return null;
  return {
    name: match[1].trim(),
    skills: splitKeywords(match[2]),
  };
}

function isMissingContent(value: string) {
  return !value.trim() || /缺少|暂无|空|missing|none/i.test(value);
}

export function buildSuggestionUpdate(
  resume: ResumeWithSections,
  suggestion: ApplicableSuggestion,
): SuggestionUpdate {
  const section = (resume.sections as ResumeSection[]).find((item) => item.type === suggestion.sectionType);
  if (!section) {
    throw new Error('Target section not found');
  }

  const content: MutableSectionContent = { ...(section.content as unknown as MutableSectionContent) };
  const previousContent = section.content;
  let applied = false;

  if (section.type === 'summary') {
    content.text = suggestion.suggested;
    applied = true;
  } else if (section.type === 'skills') {
    const categories: SkillCategoryDraft[] = Array.isArray(content.categories)
      ? (content.categories as SkillCategoryDraft[]).map((category) => ({ ...category }))
      : [];
    const currentLine = parseCategoryLine(suggestion.current);
    const suggestedLine = parseCategoryLine(suggestion.suggested);
    const targetCategory = categories.find((category) => (
      (currentLine && category.name && compactText(category.name) === compactText(currentLine.name)) ||
      (suggestedLine && category.name && compactText(category.name) === compactText(suggestedLine.name))
    ));

    if (targetCategory && suggestedLine) {
      targetCategory.name = suggestedLine.name;
      targetCategory.skills = suggestedLine.skills;
      applied = true;
    } else {
      for (const category of categories) {
        const skills = Array.isArray(category.skills) ? category.skills : [];
        const replacement = replaceFirstMatchingText(skills, suggestion.current, suggestion.suggested);
        if (replacement.replaced) {
          category.skills = replacement.next;
          applied = true;
          break;
        }
      }
    }

    if (!applied && isMissingContent(suggestion.current)) {
      const additions = suggestedLine?.skills || splitKeywords(suggestion.suggested);
      const categoryName = suggestedLine?.name || (resume.language === 'en' ? 'JD Match' : 'JD 匹配');
      const existing = categories.find((category) => category.name === categoryName);
      if (existing) {
        existing.skills = appendUnique(Array.isArray(existing.skills) ? existing.skills : [], additions);
      } else {
        categories.push({ id: crypto.randomUUID(), name: categoryName, skills: additions });
      }
      applied = true;
    }

    content.categories = categories;
  } else if (section.type === 'projects' || section.type === 'work_experience') {
    const items: HighlightItemDraft[] = Array.isArray(content.items)
      ? (content.items as HighlightItemDraft[]).map((item) => ({ ...item }))
      : [];
    if (items.length === 0) {
      throw new Error('Target section has no items to update');
    }

    for (let index = 0; index < items.length; index++) {
      const item = { ...items[index] };
      const targetField = suggestion.targetField.toLowerCase();

      if (targetField.includes('description') && textMatches(item.description, suggestion.current)) {
        item.description = suggestion.suggested;
        items[index] = item;
        applied = true;
        break;
      }

      if (Array.isArray(item.highlights)) {
        const replacement = replaceFirstMatchingText(item.highlights, suggestion.current, suggestion.suggested);
        if (replacement.replaced) {
          item.highlights = replacement.next;
          items[index] = item;
          applied = true;
          break;
        }
      }

      if (!applied && textMatches(item.description, suggestion.current)) {
        item.description = suggestion.suggested;
        items[index] = item;
        applied = true;
        break;
      }
    }

    if (!applied && isMissingContent(suggestion.current)) {
      const first = { ...items[0] };
      first.highlights = appendUnique(Array.isArray(first.highlights) ? first.highlights : [], [suggestion.suggested]);
      items[0] = first;
      applied = true;
    }

    content.items = items;
  } else {
    throw new Error('Unsupported target section');
  }

  if (!applied) {
    throw new Error('Original content not found, skipped to avoid adding duplicate content');
  }

  return {
    section,
    previousContent,
    nextContent: content,
  };
}
