import { describe, expect, it } from 'vitest';
import { mergeTailoredSections } from './resume-tailoring';

describe('mergeTailoredSections', () => {
  it('updates only matching experience and project items while preserving source facts', () => {
    const sections = [
      {
        id: 'work-section',
        type: 'work_experience',
        content: {
          items: [
            {
              id: 'work-1',
              company: 'Acme',
              position: 'Engineer',
              startDate: '2023-01',
              endDate: null,
              description: 'Built product features.',
              highlights: ['Shipped releases'],
            },
          ],
        },
      },
      {
        id: 'project-section',
        type: 'projects',
        content: {
          items: [
            {
              id: 'project-1',
              name: 'Existing Project',
              url: 'https://example.com',
              description: 'Original description',
              technologies: ['React'],
              highlights: ['Original result'],
            },
          ],
        },
      },
    ];

    const result = mergeTailoredSections(sections, {
      workExperience: [
        { id: 'work-1', description: 'Built JD-relevant product features.', highlights: ['Shipped releases safely'] },
        { id: 'unknown-work', description: 'Must not be added.', highlights: [] },
      ],
      projects: [
        {
          id: 'project-1',
          description: 'JD-relevant description',
          technologies: ['React', 'TypeScript'],
          highlights: ['Original result, clarified'],
        },
      ],
    });

    const work = result[0].content as { items: Array<Record<string, unknown>> };
    const project = result[1].content as { items: Array<Record<string, unknown>> };
    expect(work.items).toEqual([{
      id: 'work-1',
      company: 'Acme',
      position: 'Engineer',
      startDate: '2023-01',
      endDate: null,
      description: 'Built JD-relevant product features.',
      highlights: ['Shipped releases safely'],
    }]);
    expect(project.items).toEqual([{
      id: 'project-1',
      name: 'Existing Project',
      url: 'https://example.com',
      description: 'JD-relevant description',
      technologies: ['React', 'TypeScript'],
      highlights: ['Original result, clarified'],
    }]);
  });

  it('keeps existing skill category identity and leaves unrelated sections untouched', () => {
    const sections = [
      {
        id: 'skills-section',
        type: 'skills',
        content: {
          categories: [{ id: 'frontend-category', name: 'Frontend', skills: ['React', 'TypeScript'] }],
        },
      },
      {
        id: 'education-section',
        type: 'education',
        content: { items: [{ id: 'education-1', institution: 'University' }] },
      },
    ];

    const result = mergeTailoredSections(sections, {
      skills: { categories: [{ name: 'Frontend', skills: ['React', 'TypeScript', 'Invented Skill'] }] },
    });

    expect(result[0].content).toEqual({
      categories: [{ id: 'frontend-category', name: 'Frontend', skills: ['React', 'TypeScript'] }],
    });
    expect(result[1]).toBe(sections[1]);
  });
});
