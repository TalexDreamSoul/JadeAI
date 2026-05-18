import { NextRequest, NextResponse } from 'next/server';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { getModel, extractAIConfig, getProviderOptions, AIConfigError } from '@/lib/ai/provider';
import { extractJson } from '@/lib/ai/extract-json';
import { getResumeSectionsContext, normalizeResumeSnapshot } from '@/lib/ai/resume-snapshot';

const aiReviewSchema = z.object({
  score: z.number().min(0).max(100),
  summary: z.string(),
  strengths: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  actions: z.array(z.object({
    section: z.string(),
    priority: z.enum(['high', 'medium', 'low']).default('medium'),
    suggestion: z.string(),
  })).default([]),
});

const SYSTEM = `You are a senior resume reviewer. Review the resume for recruiter readability, ATS quality, impact, clarity, and role alignment.
Return JSON only with fields: score, summary, strengths, risks, actions. Match the resume language.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const resume = normalizeResumeSnapshot(body.resume, body.resumeId || 'local');
    if (!resume) {
      return NextResponse.json({ error: 'Resume snapshot is required' }, { status: 400 });
    }

    const aiConfig = await extractAIConfig(request);
    const result = await generateText({
      model: getModel(aiConfig),
      system: SYSTEM,
      prompt: JSON.stringify({
        resume: JSON.parse(getResumeSectionsContext(resume)),
        targetCompany: resume.targetCompany,
        targetJobTitle: resume.targetJobTitle,
        jobDescription: resume.jobDescription,
        focus: body.focus || 'overall',
      }),
      maxOutputTokens: 4096,
      providerOptions: getProviderOptions(aiConfig),
      output: Output.json(),
    });

    const review = extractJson(result.text, aiReviewSchema);
    return NextResponse.json(review);
  } catch (error) {
    if (error instanceof AIConfigError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error('POST /api/ai/resume-review error:', error);
    return NextResponse.json({ error: 'Failed to review resume' }, { status: 500 });
  }
}
