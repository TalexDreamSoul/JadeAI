import { z } from 'zod/v4';

export const textAnnotationSchema = z.object({
  summary: z.string().default(''),
  overallScore: z.number().min(0).max(100).default(0),
  annotations: z.array(z.object({
    id: z.string().optional(),
    section: z.string().optional(),
    sectionId: z.string().optional(),
    quote: z.string().optional(),
    severity: z.enum(['low', 'medium', 'high']).or(z.string()).default('medium'),
    category: z.string().default('analysis'),
    comment: z.string().default(''),
    suggestion: z.string().default(''),
    evidence: z.string().optional().default(''),
  })).default([]),
  rewrite: z.string().optional().default(''),
  keywords: z.array(z.string()).default([]),
  questions: z.array(z.string()).default([]),
});

export type TextAnnotationResult = z.infer<typeof textAnnotationSchema>;
