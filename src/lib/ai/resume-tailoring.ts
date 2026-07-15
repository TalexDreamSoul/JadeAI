import { z } from 'zod';

export const resumeTailoringSchema = z.object({
  summary: z.object({ text: z.string() }).optional(),
  skills: z.object({
    categories: z.array(z.object({
      name: z.string(),
      skills: z.array(z.string()),
    })),
  }).optional(),
  workExperience: z.array(z.object({
    id: z.string(),
    description: z.string(),
    highlights: z.array(z.string()),
  })).optional(),
  projects: z.array(z.object({
    id: z.string(),
    description: z.string(),
    technologies: z.array(z.string()),
    highlights: z.array(z.string()),
  })).optional(),
});

export type ResumeTailoring = z.infer<typeof resumeTailoringSchema>;

type TailorableSection = {
  type: string;
  content: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function mergeTailoredSections<T extends TailorableSection>(
  sections: T[],
  tailored: ResumeTailoring
): T[] {
  return sections.map((section) => {
    const content = asRecord(section.content);

    if (section.type === 'summary' && tailored.summary) {
      return { ...section, content: { ...content, text: tailored.summary.text } };
    }

    if (section.type === 'skills' && tailored.skills) {
      const currentCategories = Array.isArray(content.categories)
        ? content.categories.map(asRecord)
        : [];
      const knownSkills = new Map<string, string>();
      for (const category of currentCategories) {
        if (!Array.isArray(category.skills)) continue;
        for (const skill of category.skills) {
          if (typeof skill === 'string') knownSkills.set(skill.trim().toLowerCase(), skill);
        }
      }
      const optimizedCategories = tailored.skills.categories
        .map((category) => {
          const current = currentCategories.find((item) => item.name === category.name);
          const skills = Array.from(new Set(category.skills
            .map((skill) => knownSkills.get(skill.trim().toLowerCase()))
            .filter((skill): skill is string => !!skill)));
          return { ...current, id: current?.id || crypto.randomUUID(), name: category.name, skills };
        })
        .filter((category) => category.skills.length > 0);
      const categories = optimizedCategories.length > 0 ? optimizedCategories : currentCategories;
      return { ...section, content: { ...content, categories } };
    }

    if (section.type === 'work_experience' && tailored.workExperience) {
      const changes = new Map(tailored.workExperience.map((item) => [item.id, item]));
      const items = Array.isArray(content.items)
        ? content.items.map((value) => {
            const item = asRecord(value);
            const change = typeof item.id === 'string' ? changes.get(item.id) : undefined;
            return change ? { ...item, description: change.description, highlights: change.highlights } : item;
          })
        : [];
      return { ...section, content: { ...content, items } };
    }

    if (section.type === 'projects' && tailored.projects) {
      const changes = new Map(tailored.projects.map((item) => [item.id, item]));
      const items = Array.isArray(content.items)
        ? content.items.map((value) => {
            const item = asRecord(value);
            const change = typeof item.id === 'string' ? changes.get(item.id) : undefined;
            return change
              ? {
                  ...item,
                  description: change.description,
                  technologies: change.technologies,
                  highlights: change.highlights,
                }
              : item;
          })
        : [];
      return { ...section, content: { ...content, items } };
    }

    return section;
  });
}
