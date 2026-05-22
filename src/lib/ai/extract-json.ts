import { jsonrepair } from 'jsonrepair';
import type { ZodType } from 'zod/v4';

export class AIJsonExtractionError extends Error {
  code = 'AI_JSON_EXTRACTION_FAILED' as const;
  details: {
    length: number;
    stage?: string;
    issues?: string[];
    preview?: string;
  };

  constructor(message: string, details: AIJsonExtractionError['details']) {
    super(message);
    this.name = 'AIJsonExtractionError';
    this.details = details;
  }
}

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function previewText(text: string, max = 500) {
  return text.slice(0, max).replace(/\s+/g, ' ').trim();
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'Unknown error');
}

function summarizeSchemaIssues(error: unknown): string[] {
  if (error && typeof error === 'object' && 'issues' in error && Array.isArray((error as { issues?: unknown }).issues)) {
    return ((error as { issues: Array<{ path?: unknown[]; message?: string }> }).issues || [])
      .slice(0, 8)
      .map((issue) => `${Array.isArray(issue.path) && issue.path.length ? issue.path.join('.') : '(root)'}: ${issue.message || 'Invalid value'}`);
  }
  return [getErrorMessage(error)].filter(Boolean).slice(0, 3);
}

function buildExtractionError(text: string, cleaned: string, stage: string, issues?: string[]) {
  return new AIJsonExtractionError('AI returned an invalid JSON format. Please retry or switch model.', {
    length: text.length,
    stage,
    issues,
    ...(isProduction() ? {} : { preview: previewText(cleaned) }),
  });
}

/**
 * Repair unescaped double quotes inside JSON string values.
 *
 * AI models often output JSON like:
 *   "suggestion": "如"some text"more"
 * where the inner " are content quotes that should be escaped as \".
 */
function repairUnescapedQuotes(text: string): string {
  const len = text.length;
  const out: string[] = [];
  let inString = false;
  let i = 0;

  while (i < len) {
    const ch = text[i];

    if (inString && ch === '\\') {
      out.push(ch);
      if (i + 1 < len) {
        out.push(text[i + 1]);
        i += 2;
      } else {
        i++;
      }
      continue;
    }

    if (ch === '"') {
      if (!inString) {
        inString = true;
        out.push(ch);
      } else {
        let j = i + 1;
        while (j < len && (text[j] === ' ' || text[j] === '\t' || text[j] === '\n' || text[j] === '\r')) {
          j++;
        }
        const next = j < len ? text[j] : '';
        if (next === '' || next === ',' || next === '}' || next === ']' || next === ':') {
          inString = false;
          out.push(ch);
        } else {
          out.push('\\', '"');
        }
      }
    } else {
      out.push(ch);
    }
    i++;
  }

  return out.join('');
}

/** Strip <think>...</think> reasoning blocks (qwen3, deepseek-r1, etc.) */
function stripThinkBlocks(text: string): string {
  let out = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
  out = out.replace(/^[\s\S]*?<\/think>/i, '');
  out = out.replace(/<\|?thinking\|?>[\s\S]*?<\|?\/?thinking\|?>/gi, '');
  return out.trim();
}

/** Strip markdown code fences from text */
function stripFences(text: string): string {
  const m = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  return m ? m[1].trim() : text;
}

/** Common key aliases AI models invent instead of the canonical schema keys */
const KEY_ALIASES: Record<string, string> = {
  comprehensiveScore: 'overallScore',
  totalScore: 'overallScore',
  finalScore: 'overallScore',
  matchScore: 'overallScore',
  matchingScore: 'overallScore',
  atsCompatibilityScore: 'atsScore',
  capabilityScores: 'dimensionScores',
  competencyScores: 'dimensionScores',
  abilityScores: 'dimensionScores',
  rounds: 'roundEvaluations',
  evaluations: 'roundEvaluations',
  feedback: 'overallFeedback',
  overallSummary: 'overallFeedback',
  improvements: 'improvementPlan',
  improvementSuggestions: 'improvementPlan',
  improvementAreas: 'improvementPlan',
  recommendations: 'suggestions',
  nextActions: 'actions',
  weaknesses: 'risks',
  direction: 'description',
};

function normalizeKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeKeys);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const nk = KEY_ALIASES[k] ?? k;
      out[nk] = normalizeKeys(v);
    }
    return out;
  }
  return value;
}

type ParseFailure = { ok: false; stage: string; issues: string[] };
type ParseResult<T> = { ok: true; data: T } | ParseFailure;

function tryParseDetailed<T>(text: string, schema: ZodType<T>): ParseResult<T> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { ok: false, stage: 'json-parse', issues: [getErrorMessage(error)] };
  }

  const normalized = normalizeKeys(parsed);
  const result = schema.safeParse(normalized);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, stage: 'schema-validation', issues: summarizeSchemaIssues(result.error) };
}

function tryParsedCandidate<T>(text: string, schema: ZodType<T>, failures: ParseFailure[]): T | null {
  const parsed = tryParseDetailed(text, schema);
  if (parsed.ok) return parsed.data;
  failures.push(parsed);
  return null;
}

function logFailure(error: AIJsonExtractionError) {
  console.warn('[extractJson] failed', {
    length: error.details.length,
    stage: error.details.stage,
    issues: error.details.issues,
    ...(error.details.preview ? { preview: error.details.preview } : {}),
  });
}

function doExtractJson<T>(text: string, schema: ZodType<T>): { ok: true; data: T } | { ok: false; error: AIJsonExtractionError } {
  const trimmed = text.trim();
  const noThink = stripThinkBlocks(trimmed);
  const cleaned = stripFences(noThink);
  const failures: ParseFailure[] = [];

  const direct = tryParsedCandidate(cleaned, schema, failures);
  if (direct !== null) return { ok: true, data: direct };

  const repaired = repairUnescapedQuotes(cleaned);
  const afterRepair = tryParsedCandidate(repaired, schema, failures);
  if (afterRepair !== null) return { ok: true, data: afterRepair };

  try {
    const jr = jsonrepair(repaired);
    const r = tryParsedCandidate(jr, schema, failures);
    if (r !== null) return { ok: true, data: r };
  } catch (error) {
    failures.push({ ok: false, stage: 'jsonrepair', issues: [getErrorMessage(error)] });
  }

  const braceStart = cleaned.indexOf('{');
  const braceEnd = cleaned.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd > braceStart) {
    const slice = cleaned.slice(braceStart, braceEnd + 1);
    const repairedSlice = repairUnescapedQuotes(slice);
    const r = tryParsedCandidate(repairedSlice, schema, failures);
    if (r !== null) return { ok: true, data: r };
    try {
      const jr = jsonrepair(repairedSlice);
      const r2 = tryParsedCandidate(jr, schema, failures);
      if (r2 !== null) return { ok: true, data: r2 };
    } catch (error) {
      failures.push({ ok: false, stage: 'jsonrepair-slice', issues: [getErrorMessage(error)] });
    }
  }

  const bracketStart = cleaned.indexOf('[');
  const bracketEnd = cleaned.lastIndexOf(']');
  if (bracketStart !== -1 && bracketEnd > bracketStart) {
    const arrSlice = cleaned.slice(bracketStart, bracketEnd + 1);
    for (const candidate of [arrSlice]) {
      try {
        const parsed = JSON.parse(candidate);
        if (Array.isArray(parsed) && parsed.length === 1 && typeof parsed[0] === 'object') {
          const r = tryParsedCandidate(JSON.stringify(parsed[0]), schema, failures);
          if (r !== null) return { ok: true, data: r };
        }
      } catch (error) {
        failures.push({ ok: false, stage: 'array-unwrap', issues: [getErrorMessage(error)] });
      }
      try {
        const jr = jsonrepair(candidate);
        const parsed = JSON.parse(jr);
        if (Array.isArray(parsed) && parsed.length === 1 && typeof parsed[0] === 'object') {
          const r = tryParsedCandidate(JSON.stringify(parsed[0]), schema, failures);
          if (r !== null) return { ok: true, data: r };
        }
      } catch (error) {
        failures.push({ ok: false, stage: 'array-unwrap-repair', issues: [getErrorMessage(error)] });
      }
    }
  }

  const lastFailure = failures.at(-1);
  const error = buildExtractionError(text, cleaned, lastFailure?.stage || 'unknown', lastFailure?.issues);
  logFailure(error);
  return { ok: false, error };
}

export function tryExtractJson<T>(text: string, schema: ZodType<T>): { ok: true; data: T } | { ok: false; error: AIJsonExtractionError } {
  return doExtractJson(text, schema);
}

/**
 * Robustly extract and validate a JSON object from AI text output.
 * Handles: code fences, reasoning blocks, unescaped quotes, truncated JSON, extra text, and array-wrapped objects.
 */
export function extractJson<T>(text: string, schema: ZodType<T>): T {
  const result = doExtractJson(text, schema);
  if (result.ok) return result.data;
  throw result.error;
}
