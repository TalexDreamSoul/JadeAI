import { generateText, Output, type LanguageModel, type LanguageModelUsage } from 'ai';
import type { ZodType } from 'zod/v4';
import { AIJsonExtractionError, tryExtractJson } from '@/lib/ai/extract-json';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

interface GenerateJsonWithRetryOptions<T> {
  model: LanguageModel;
  schema: ZodType<T>;
  system: string;
  prompt: string;
  providerOptions?: Record<string, JsonObject>;
  maxOutputTokens?: number;
  retries?: number;
  label?: string;
}

export interface GenerateJsonResult<T> {
  data: T;
  attempts: number;
  usage?: LanguageModelUsage;
}

function addTokenCounts(left: number | undefined, right: number | undefined) {
  return left == null && right == null ? undefined : (left ?? 0) + (right ?? 0);
}

export function addLanguageModelUsages(
  left: Partial<LanguageModelUsage> | undefined | null,
  right: Partial<LanguageModelUsage> | undefined | null,
): LanguageModelUsage | undefined {
  if (!left && !right) return undefined;
  return {
    inputTokens: addTokenCounts(left?.inputTokens, right?.inputTokens),
    inputTokenDetails: {
      noCacheTokens: addTokenCounts(left?.inputTokenDetails?.noCacheTokens, right?.inputTokenDetails?.noCacheTokens),
      cacheReadTokens: addTokenCounts(left?.inputTokenDetails?.cacheReadTokens, right?.inputTokenDetails?.cacheReadTokens),
      cacheWriteTokens: addTokenCounts(left?.inputTokenDetails?.cacheWriteTokens, right?.inputTokenDetails?.cacheWriteTokens),
    },
    outputTokens: addTokenCounts(left?.outputTokens, right?.outputTokens),
    outputTokenDetails: {
      textTokens: addTokenCounts(left?.outputTokenDetails?.textTokens, right?.outputTokenDetails?.textTokens),
      reasoningTokens: addTokenCounts(left?.outputTokenDetails?.reasoningTokens, right?.outputTokenDetails?.reasoningTokens),
    },
    totalTokens: addTokenCounts(left?.totalTokens, right?.totalTokens),
    reasoningTokens: addTokenCounts(left?.reasoningTokens, right?.reasoningTokens),
    cachedInputTokens: addTokenCounts(left?.cachedInputTokens, right?.cachedInputTokens),
    raw: undefined,
  };
}

function rawPreview(text: string, max = 3000) {
  return text.length > max ? `${text.slice(0, max)}\n...<truncated ${text.length - max} chars>` : text;
}

function repairPrompt(originalPrompt: string, previousText: string, error: AIJsonExtractionError) {
  return `Your previous response was not valid JSON for this API contract.

Rules:
- Return one valid JSON object only.
- Do not include markdown fences, comments, analysis, or explanatory text.
- Use the exact field names requested in the original task.
- Fill missing arrays with [] and missing strings with "" when necessary.

Validation failure summary:
${JSON.stringify({ stage: error.details.stage, issues: error.details.issues }, null, 2)}

Original task:
${originalPrompt}

Previous invalid response:
${rawPreview(previousText)}

Now return only the corrected JSON object.`;
}

export async function generateJsonWithRetry<T>({
  model,
  schema,
  system,
  prompt,
  providerOptions,
  maxOutputTokens,
  retries = 1,
  label = 'ai-json',
}: GenerateJsonWithRetryOptions<T>): Promise<GenerateJsonResult<T>> {
  let lastText = '';
  let lastError: AIJsonExtractionError | null = null;
  let totalUsage: LanguageModelUsage | undefined;
  const totalAttempts = Math.max(1, retries + 1);

  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    const result: Awaited<ReturnType<typeof generateText>> = await generateText({
      model,
      system,
      prompt: attempt === 1 || !lastError ? prompt : repairPrompt(prompt, lastText, lastError),
      maxOutputTokens,
      providerOptions,
      output: Output.json(),
    });
    totalUsage = addLanguageModelUsages(totalUsage, result.usage);

    lastText = result.text;
    const parsed: ReturnType<typeof tryExtractJson<T>> = tryExtractJson(result.text, schema);
    if (parsed.ok) return { data: parsed.data, attempts: attempt, usage: totalUsage };

    const parseError = parsed.error;
    lastError = parseError;
    console.warn('[generateJsonWithRetry] invalid JSON response', {
      label,
      attempt,
      maxAttempts: totalAttempts,
      length: parseError.details.length,
      stage: parseError.details.stage,
      issues: parseError.details.issues,
    });
  }

  throw lastError || new AIJsonExtractionError('AI returned an invalid JSON format. Please retry or switch model.', {
    length: lastText.length,
    stage: 'unknown',
  });
}

export function getAIJsonErrorMessage(error: unknown, fallback: string) {
  if (error instanceof AIJsonExtractionError) {
    return 'AI 返回格式异常，请稍后重试或切换模型。';
  }
  return error instanceof Error ? error.message : fallback;
}
