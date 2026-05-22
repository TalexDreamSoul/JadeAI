import { z } from 'zod/v4';

export const aiReviewSchema = z.object({
  score: z.coerce.number().min(0).max(100),
  summary: z.string().default(''),
  strengths: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  actions: z.array(z.object({
    section: z.string().default('overall'),
    priority: z.enum(['high', 'medium', 'low']).default('medium'),
    suggestion: z.string().default(''),
  })).default([]),
});

export type AIReviewResult = z.infer<typeof aiReviewSchema>;
