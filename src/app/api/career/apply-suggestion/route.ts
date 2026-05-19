import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { applicableSuggestionSchema } from '@/lib/ai/jd-analysis-schema';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import type { ResumeSection } from '@/types/resume';

const inputSchema = z.object({
  resumeId: z.string().min(1),
  suggestion: applicableSuggestionSchema,
});

type MutableSectionContent = Record<string, unknown>;
type SkillCategoryDraft = {
  id?: string;
  name?: string;
  skills?: string[];
};
type HighlightItemDraft = {
  highlights?: string[];
  [key: string]: unknown;
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

export async function POST(request: NextRequest) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = inputSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
    }

    const { resumeId, suggestion } = parsed.data;
    const resume = await resumeRepository.findById(resumeId);
    if (!resume) return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    if (resume.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const section = (resume.sections as ResumeSection[]).find((item) => item.type === suggestion.sectionType);
    if (!section) return NextResponse.json({ error: 'Target section not found' }, { status: 404 });

    const before = resume;
    const content: MutableSectionContent = { ...(section.content as unknown as MutableSectionContent) };
    const previousContent = section.content;

    if (section.type === 'summary') {
      content.text = suggestion.suggested;
    } else if (section.type === 'skills') {
      const categories: SkillCategoryDraft[] = Array.isArray(content.categories)
        ? (content.categories as SkillCategoryDraft[]).map((category) => ({ ...category }))
        : [];
      const additions = splitKeywords(suggestion.suggested);
      const categoryName = resume.language === 'en' ? 'JD Match' : 'JD 匹配';
      const existing = categories.find((category) => category.name === categoryName);
      if (existing) {
        existing.skills = appendUnique(Array.isArray(existing.skills) ? existing.skills : [], additions);
      } else {
        categories.push({ id: crypto.randomUUID(), name: categoryName, skills: additions });
      }
      content.categories = categories;
    } else if (section.type === 'projects' || section.type === 'work_experience') {
      const items: HighlightItemDraft[] = Array.isArray(content.items)
        ? (content.items as HighlightItemDraft[]).map((item) => ({ ...item }))
        : [];
      if (items.length === 0) {
        return NextResponse.json({ error: 'Target section has no items to update' }, { status: 400 });
      }
      const first = { ...items[0] };
      first.highlights = appendUnique(Array.isArray(first.highlights) ? first.highlights : [], [suggestion.suggested]);
      items[0] = first;
      content.items = items;
    } else {
      return NextResponse.json({ error: 'Unsupported target section' }, { status: 400 });
    }

    await resumeRepository.updateSection(section.id, { content });
    const updated = await resumeRepository.findById(resumeId);
    if (updated) {
      await resumeRepository.createVersion(resumeId, `career-apply-before-${Date.now()}`, before, 'jd').catch(() => null);
      await resumeRepository.createVersion(resumeId, `career-apply-after-${Date.now()}`, updated, 'jd').catch(() => null);
      await resumeRepository.createEvent({
        resumeId,
        userId: user.id,
        type: 'career.suggestion_applied',
        title: 'JD suggestion applied',
        description: suggestion.reason,
        metadata: { suggestion },
      }).catch(() => null);
    }

    return NextResponse.json({ resume: updated, sectionId: section.id, previousContent });
  } catch (error) {
    console.error('POST /api/career/apply-suggestion error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
