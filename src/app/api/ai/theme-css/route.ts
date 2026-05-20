import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { z } from 'zod/v4';
import { AIConfigError, extractAIConfig, getModel, getProviderOptions } from '@/lib/ai/provider';
import { sanitizeCustomCss } from '@/lib/template-customization';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { userRepository } from '@/lib/db/repositories/user.repository';
import { extractJson } from '@/lib/ai/extract-json';

const inputSchema = z.object({
  prompt: z.string().min(2).max(1200),
  currentCss: z.string().max(20000).optional().default(''),
  template: z.string().max(80).optional().default(''),
  theme: z.unknown().optional(),
});

const outputSchema = z.object({
  css: z.string().min(1).max(12000),
});

function extractCss(text: string): string {
  try {
    const json = extractJson(text, outputSchema);
    if (json?.css) return json.css;
  } catch {
    // Some providers still return raw CSS despite the JSON instruction.
  }

  const fenced = text.match(/```(?:css)?\s*\n?([\s\S]*?)\n?\s*```/i);
  return fenced ? fenced[1].trim() : text.trim();
}

export async function POST(request: NextRequest) {
  try {
    const fingerprint = getUserIdFromRequest(request);
    const user = await resolveUser(fingerprint);
    const body = inputSchema.parse(await request.json());

    const aiConfig = await extractAIConfig(request);
    const model = getModel(aiConfig);

    const result = await generateText({
      model,
      providerOptions: getProviderOptions(aiConfig),
      system: `You are a resume CSS theme designer.
Return ONLY JSON in this shape: {"css":"..."}.
The CSS will be automatically scoped to the current resume preview, so write normal selectors.
Allowed selectors include: > div, header, h1, h2, h3, p, ul, li, [data-section], [data-section-type="summary"], [data-section-type="work_experience"], [data-section-type="projects"], [data-section-type="education"], [data-section-type="skills"], [data-section-type="certifications"], [data-section-type="languages"], [data-section-type="github"], [data-section-type="qr_codes"], [data-section-type="custom"].
Prefer compact, print-friendly CSS. You may use borders, accent lines, subtle backgrounds, spacing, text alignment, pseudo-elements on > div, header, or [data-section].
Do NOT use @import, script, external url(), position: fixed, huge animations, or selectors outside the resume.`, 
      prompt: `Current template: ${body.template || 'unknown'}
Current theme JSON:
${JSON.stringify(body.theme || {}, null, 2).slice(0, 6000)}

Current custom CSS:
${body.currentCss || '(empty)'}

User request:
${body.prompt}

Generate a complete replacement custom CSS block that can be applied directly.`,
    });

    const css = sanitizeCustomCss(extractCss(result.text)).trim();
    if (!css) {
      return NextResponse.json({ error: 'Empty CSS generated' }, { status: 422 });
    }

    if (user && aiConfig.mode === 'server') {
      await userRepository.consumeAICredit(user.id).catch(() => null);
    }

    return NextResponse.json({ css });
  } catch (error) {
    if (error instanceof AIConfigError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error('POST /api/ai/theme-css error:', error);
    return NextResponse.json({ error: 'Failed to generate theme CSS' }, { status: 500 });
  }
}
