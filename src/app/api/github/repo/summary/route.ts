import { NextRequest, NextResponse } from 'next/server';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { extractAIConfig, getModel, getProviderOptions, AIConfigError } from '@/lib/ai/provider';
import { userRepository } from '@/lib/db/repositories/user.repository';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { extractJson } from '@/lib/ai/extract-json';

const repoSummarySchema = z.object({
  name: z.string(),
  description: z.string(),
  technologies: z.array(z.string()).default([]),
  highlights: z.array(z.string()).default([]),
});

const SYSTEM = `You write resume project descriptions from Git repository metadata.
Return JSON only: name, description, technologies, highlights. Keep it concise, factual, and recruiter friendly.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const repo = body.repo;
    if (!repo?.url && !repo?.name) {
      return NextResponse.json({ error: 'Repository metadata is required' }, { status: 400 });
    }

    const user = await resolveUser(getUserIdFromRequest(request));
    const aiConfig = await extractAIConfig(request);
    const chargeAICredit = () => aiConfig.mode === 'server' ? userRepository.consumeAICredit(user.id) : Promise.resolve(true);
    const result = await generateText({
      model: getModel(aiConfig),
      system: SYSTEM,
      prompt: JSON.stringify({
        repo,
        targetRole: body.targetRole || '',
        language: body.language || 'zh',
      }),
      maxOutputTokens: 2048,
      providerOptions: getProviderOptions(aiConfig),
      output: Output.json(),
    });

    await chargeAICredit();
    return NextResponse.json(extractJson(result.text, repoSummarySchema));
  } catch (error) {
    if (error instanceof AIConfigError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error('POST /api/github/repo/summary error:', error);
    return NextResponse.json({ error: 'Failed to summarize repository' }, { status: 500 });
  }
}
