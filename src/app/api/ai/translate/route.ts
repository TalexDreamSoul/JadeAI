import { NextRequest } from 'next/server';
import { generateText, Output, type LanguageModel, type LanguageModelUsage } from 'ai';
import { getModel, extractAIConfig, getProviderOptions, AIConfigError, type AIConfig } from '@/lib/ai/provider';
import { resolveUser, getUserIdFromRequest } from '@/lib/auth/helpers';
import { userRepository } from '@/lib/db/repositories/user.repository';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import { isLocalResumeId } from '@/lib/local-resumes';
import { normalizeResumeSnapshot, type AIResumeSnapshot } from '@/lib/ai/resume-snapshot';
import { translateInputSchema } from '@/lib/ai/translate-schema';
import { extractJson } from '@/lib/ai/extract-json';
import { completeAIUsage, refundAIUsage } from '@/lib/commercial/ai-metering-service';
import {
  assertCanCreateResume,
  commercialFeatureLockedResponse,
  CommercialFeatureLockedError,
} from '@/lib/commercial/feature-gate-service';
import { z } from 'zod/v4';

const LANGUAGE_NAMES: Record<string, string> = {
  zh: 'Simplified Chinese',
  en: 'English',
  ja: 'Japanese',
  ko: 'Korean',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
  pt: 'Portuguese',
  ru: 'Russian',
  ar: 'Arabic',
};

/** Fields to strip before sending to AI (e.g. base64 avatar), keyed by section type */
const STRIP_FIELDS: Record<string, string[]> = {
  personal_info: ['avatar'],
};

const MAX_CONCURRENCY = 4;

const singleSectionSchema = z.object({
  sectionId: z.string(),
  title: z.string(),
  content: z.unknown(),
});

type TranslatedSectionResult = z.infer<typeof singleSectionSchema> & {
  usage?: LanguageModelUsage;
};

type ResumeSectionRecord = {
  id: string;
  type: string;
  title: string;
  content: unknown;
};

function getSectionTranslatePrompt(targetLanguage: string): string {
  const langName = LANGUAGE_NAMES[targetLanguage] || targetLanguage;

  return `You are a professional resume translator. Translate the given resume section into ${langName}.

Rules:
- Use professional, formal ${langName} appropriate for resumes
- Translate job titles, descriptions, and achievements naturally
- Keep proper nouns in their commonly recognized form. If no standard translation exists, keep original
- Dates remain in the same format (YYYY-MM)
- Technical terms and programming languages stay in English (e.g., JavaScript, React, AWS)
- Section titles should use standard resume headings in the target language
- Preserve the exact JSON structure and all field names — only translate string values
- Keep all IDs, URLs, emails, phone numbers unchanged
- CRITICAL: Return a single valid JSON object. No markdown, no code fences, no extra text.`;
}

async function translateSection(
  section: { sectionId: string; type: string; title: string; content: unknown },
  targetLanguage: string,
  model: LanguageModel,
  aiConfig: AIConfig
) {
  const result = await generateText({
    model,
    maxOutputTokens: 4096,
    system: getSectionTranslatePrompt(targetLanguage),
    prompt: `Translate this resume section. Return JSON with keys: sectionId, title, content.\n\n${JSON.stringify(section)}`,
    providerOptions: getProviderOptions(aiConfig),
    output: Output.json(),
  });

  return { ...extractJson(result.text, singleSectionSchema), usage: result.usage };
}

/** Run async tasks with a concurrency limit */
async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
  onSettled?: (index: number, result: PromiseSettledResult<R>) => void
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      try {
        const r = await fn(items[i]);
        results[i] = { status: 'fulfilled', value: r };
      } catch (e) {
        results[i] = { status: 'rejected', reason: e };
      }
      onSettled?.(i, results[i]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function POST(request: NextRequest) {
  try {
    const fingerprint = getUserIdFromRequest(request);
    const user = await resolveUser(fingerprint);

    const body = await request.json();
    const parsed = translateInputSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parsed.error.issues }),
        { status: 400 }
      );
    }

    const { resumeId, targetLanguage, sectionIds, mode } = parsed.data;
    const localResume = isLocalResumeId(resumeId) ? normalizeResumeSnapshot((body as Record<string, unknown>).resume, resumeId) : null;

    let resume: AIResumeSnapshot | NonNullable<Awaited<ReturnType<typeof resumeRepository.findById>>> | null = localResume;
    if (!resume) {
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
      }
      const cloudResume = await resumeRepository.findById(resumeId);
      if (!cloudResume) {
        return new Response(JSON.stringify({ error: 'Resume not found' }), { status: 404 });
      }
      if (cloudResume.userId !== user.id) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
      }
      resume = cloudResume;
    }

    if (!resume) {
      return new Response(JSON.stringify({ error: 'Resume not found' }), { status: 404 });
    }

    // In copy mode, duplicate the cloud resume first. Local copies are created client-side.
    let targetResumeId = resumeId;
    let workingSections = resume.sections;
    let newResumeId: string | undefined;

    if (mode === 'copy' && !localResume) {
      await assertCanCreateResume(user!.id, Number(user!.aiCredits || 0));
      const newTitle = `${resume.title}-${LANGUAGE_NAMES[targetLanguage] || targetLanguage}`;
      const duplicated = await resumeRepository.duplicate(resumeId, user!.id, newTitle);
      if (!duplicated) {
        return new Response(JSON.stringify({ error: 'Failed to duplicate resume' }), { status: 500 });
      }
      targetResumeId = duplicated.id;
      workingSections = duplicated.sections;
      newResumeId = duplicated.id;
    }

    const allSections = sectionIds
      ? (workingSections as ResumeSectionRecord[]).filter((s) => sectionIds.includes(s.id))
      : (workingSections as ResumeSectionRecord[]);

    if (allSections.length === 0) {
      return new Response(JSON.stringify({ error: 'No sections found to translate' }), { status: 400 });
    }

    // Build section data for AI, stripping heavy non-translatable fields (e.g. base64 avatar)
    // Save stripped fields so we can merge them back after translation
    const strippedFields = new Map<string, Record<string, unknown>>();

    const sectionsData = allSections.map((s) => {
      const fieldsToStrip = STRIP_FIELDS[s.type];
      let content = s.content;

      if (fieldsToStrip && content && typeof content === 'object') {
        const saved: Record<string, unknown> = {};
        const mutableContent = { ...(content as Record<string, unknown>) };
        for (const field of fieldsToStrip) {
          if (field in mutableContent) {
            saved[field] = mutableContent[field];
            delete mutableContent[field];
          }
        }
        if (Object.keys(saved).length > 0) {
          strippedFields.set(s.id, saved);
        }
        content = mutableContent;
      }

      return {
        sectionId: s.id,
        type: s.type,
        title: s.title,
        content,
      };
    });

    const aiConfig = await extractAIConfig(request);
    const model = getModel(aiConfig);
    const encoder = new TextEncoder();
    const aiUsage = aiConfig.mode === 'server' && user
      ? await userRepository.reserveAICredit(user.id, {
        feature: 'resume.translate',
        aiConfig,
        metadata: { resumeId: targetResumeId, targetLanguage, sectionCount: sectionsData.length },
      })
      : { ok: true as const, reservation: null };

    if (!aiUsage.ok) {
      return new Response(JSON.stringify({ error: aiUsage.error }), { status: 402 });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => {
          try {
            controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
          } catch {
            // Stream may have been cancelled by client
          }
        };

        let completed = 0;
        const total = sectionsData.length;
        let failedCount = 0;
        let results: PromiseSettledResult<TranslatedSectionResult>[] = [];

        try {
          results = await runWithConcurrency<typeof sectionsData[number], TranslatedSectionResult>(
            sectionsData,
            MAX_CONCURRENCY,
            async (section) => {
              const translated = await translateSection(section, targetLanguage, model, aiConfig);

              // Merge back stripped fields (e.g. avatar)
              const saved = strippedFields.get(translated.sectionId);
              const translatedContent = translated.content && typeof translated.content === 'object'
                ? translated.content as Record<string, unknown>
                : {};
              const content = saved
                ? { ...translatedContent, ...saved }
                : translated.content;

              if (!localResume) {
                await resumeRepository.updateSection(translated.sectionId, {
                  title: translated.title,
                  content,
                });
              }

              return { ...translated, content };
            },
            (_index, result) => {
              completed++;
              if (result.status === 'rejected') {
                failedCount++;
                send({ type: 'progress', completed, total });
              } else {
                const section = (result as PromiseFulfilledResult<z.infer<typeof singleSectionSchema>>).value;
                send({ type: 'progress', completed, total, section });
              }
            }
          );

          if (failedCount > 0) {
            console.error(
              'Some sections failed to translate:',
              results
                .filter((r) => r.status === 'rejected')
                .map((f) => (f as PromiseRejectedResult).reason)
            );
          }

          if (failedCount === total) {
            const error = new Error('All sections failed to translate');
            await refundAIUsage(aiUsage.reservation, error, {
              resumeId: targetResumeId,
              targetLanguage,
              sectionCount: sectionsData.length,
              failedCount,
            }).catch((refundError) => console.error('[ai-metering] translate refund failed:', refundError));
            send({ type: 'error', error: error.message, failedCount, total });
          } else {
            // Update resume language for cloud resumes. Local resumes are updated client-side.
            if (!localResume) {
              await resumeRepository.update(targetResumeId, { language: targetLanguage });
            }
            if (aiUsage.reservation) {
              const usage = results
                .filter((result): result is PromiseFulfilledResult<TranslatedSectionResult> => result.status === 'fulfilled')
                .reduce((sum, result) => ({
                  inputTokens: (sum.inputTokens || 0) + (result.value.usage?.inputTokens || 0),
                  outputTokens: (sum.outputTokens || 0) + (result.value.usage?.outputTokens || 0),
                  totalTokens: (sum.totalTokens || 0) + (result.value.usage?.totalTokens || 0),
                }), { inputTokens: 0, outputTokens: 0, totalTokens: 0 });
              await completeAIUsage(aiUsage.reservation, usage, { resumeId: targetResumeId, targetLanguage, sectionCount: sectionsData.length, failedCount });
            }
          }
        } catch (err) {
          console.error('Unexpected error during translation:', err);
          await refundAIUsage(aiUsage.reservation, err, { resumeId: targetResumeId, targetLanguage, sectionCount: sectionsData.length })
            .catch((refundError) => console.error('[ai-metering] translate refund failed:', refundError));
        }

        // Always send done and close — even if something above threw
        try {
          if (localResume) {
            const translatedById = new Map(
              results
                .filter((result): result is PromiseFulfilledResult<TranslatedSectionResult> => result.status === 'fulfilled')
                .map((result) => [result.value.sectionId, result.value])
            );
            const localSections = (resume.sections as ResumeSectionRecord[]).map((section) => {
              const translated = translatedById.get(section.id);
              return translated ? { ...section, title: translated.title, content: translated.content } : section;
            });
            const updatedSections = sectionIds
              ? localSections.filter((section) => sectionIds.includes(section.id))
              : localSections;
            send({
              type: 'done',
              resumeId: targetResumeId,
              language: targetLanguage,
              sections: updatedSections,
              failedCount,
            });
            return;
          }

          const updatedResume = await resumeRepository.findById(targetResumeId);
          const updatedSections = sectionIds
            ? (updatedResume?.sections as ResumeSectionRecord[] | undefined)?.filter((s) => sectionIds.includes(s.id))
            : updatedResume?.sections;

          send({
            type: 'done',
            resumeId: targetResumeId,
            language: targetLanguage,
            sections: updatedSections || [],
            failedCount,
            ...(newResumeId ? { newResumeId } : {}),
          });
        } catch (err) {
          console.error('Error fetching final data:', err);
          send({ type: 'done', resumeId: targetResumeId, language: targetLanguage, sections: [], failedCount, ...(newResumeId ? { newResumeId } : {}) });
        }

        try {
          controller.close();
        } catch {
          // Already closed
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    if (error instanceof AIConfigError) {
      return new Response(JSON.stringify({ error: error.message }), { status: 401 });
    }
    if (error instanceof CommercialFeatureLockedError) {
      return commercialFeatureLockedResponse(error);
    }
    console.error('POST /api/ai/translate error:', error);
    return new Response(JSON.stringify({ error: 'Failed to translate resume' }), { status: 500 });
  }
}
