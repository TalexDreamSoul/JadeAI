export const JOB_APPLICATION_STAGES = [
  'saved',
  'applied',
  'screening',
  'interview',
  'offer',
  'closed',
] as const;

export const JOB_APPLICATION_RESULTS = [
  'pending',
  'offer',
  'rejected',
  'withdrawn',
  'no_response',
] as const;

export type JobApplicationStage = typeof JOB_APPLICATION_STAGES[number];
export type JobApplicationResult = typeof JOB_APPLICATION_RESULTS[number];

export type JobApplicationWriteData = Partial<{
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  sourceUrl: string | null;
  stage: JobApplicationStage;
  result: JobApplicationResult;
  resumeId: string | null;
  jdAnalysisId: string | null;
  interviewSessionId: string | null;
  appliedAt: Date | null;
  resultAt: Date | null;
  notes: string;
}>;

type ParseMode = 'create' | 'patch';
type ParseResult =
  | { success: true; data: JobApplicationWriteData }
  | { success: false; errors: string[] };

const stageSet = new Set<string>(JOB_APPLICATION_STAGES);
const resultSet = new Set<string>(JOB_APPLICATION_RESULTS);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function parseDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || String(value).trim() === '') return null;
  const raw = String(value).trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T12:00:00.000Z`)
    : new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function normalizeOptionalId(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value).trim() || null;
}

export function stageForResult(result: JobApplicationResult): JobApplicationStage | null {
  if (result === 'offer') return 'offer';
  if (result === 'rejected' || result === 'withdrawn' || result === 'no_response') return 'closed';
  return null;
}

export function parseJobApplicationPayload(payload: unknown, mode: ParseMode): ParseResult {
  const input = asRecord(payload);
  const data: JobApplicationWriteData = {};
  const errors: string[] = [];

  const parseRequiredText = (key: 'companyName' | 'jobTitle', label: string, maxLength: number) => {
    if (input[key] === undefined) {
      if (mode === 'create') errors.push(`${label} is required`);
      return;
    }
    const value = String(input[key] ?? '').trim();
    if (!value) errors.push(`${label} is required`);
    else if (value.length > maxLength) errors.push(`${label} is too long`);
    else data[key] = value;
  };

  const parseOptionalText = (key: 'jobDescription' | 'notes', maxLength: number) => {
    if (input[key] === undefined) {
      if (mode === 'create') data[key] = '';
      return;
    }
    const value = String(input[key] ?? '').trim();
    if (value.length > maxLength) errors.push(`${key} is too long`);
    else data[key] = value;
  };

  parseRequiredText('companyName', 'Company name', 160);
  parseRequiredText('jobTitle', 'Job title', 160);
  parseOptionalText('jobDescription', 100_000);
  parseOptionalText('notes', 20_000);

  if (input.sourceUrl !== undefined) {
    const sourceUrl = String(input.sourceUrl ?? '').trim();
    if (!sourceUrl) {
      data.sourceUrl = null;
    } else if (sourceUrl.length > 2_000) {
      errors.push('Source URL is too long');
    } else {
      try {
        const parsed = new URL(sourceUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('Unsupported protocol');
        data.sourceUrl = parsed.toString();
      } catch {
        errors.push('Source URL must be a valid HTTP or HTTPS URL');
      }
    }
  } else if (mode === 'create') {
    data.sourceUrl = null;
  }

  if (input.stage !== undefined) {
    const stage = String(input.stage);
    if (!stageSet.has(stage)) errors.push('Invalid application stage');
    else data.stage = stage as JobApplicationStage;
  } else if (mode === 'create') {
    data.stage = 'saved';
  }

  if (input.result !== undefined) {
    const result = String(input.result);
    if (!resultSet.has(result)) {
      errors.push('Invalid application result');
    } else {
      data.result = result as JobApplicationResult;
      data.stage = stageForResult(data.result) ?? data.stage;
    }
  } else if (mode === 'create') {
    data.result = 'pending';
  }

  for (const key of ['resumeId', 'jdAnalysisId', 'interviewSessionId'] as const) {
    if (input[key] !== undefined) data[key] = normalizeOptionalId(input[key]);
    else if (mode === 'create') data[key] = null;
  }

  for (const key of ['appliedAt', 'resultAt'] as const) {
    const parsed = parseDate(input[key]);
    if (input[key] !== undefined && parsed === undefined) errors.push(`Invalid ${key}`);
    else if (input[key] !== undefined) data[key] = parsed;
    else if (mode === 'create') data[key] = null;
  }

  if (errors.length > 0) return { success: false, errors };
  if (mode === 'patch' && Object.keys(data).length === 0) {
    return { success: false, errors: ['No supported fields provided'] };
  }
  return { success: true, data };
}

export function parseJobApplicationListParams(searchParams: URLSearchParams) {
  const rawPage = Number(searchParams.get('page') || 1);
  const rawPageSize = Number(searchParams.get('pageSize') || 10);
  const stage = searchParams.get('stage') || undefined;
  const result = searchParams.get('result') || undefined;

  return {
    page: Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1,
    pageSize: Number.isFinite(rawPageSize) ? Math.min(50, Math.max(1, Math.floor(rawPageSize))) : 10,
    query: (searchParams.get('query') || '').trim().slice(0, 160),
    stage: stage && stageSet.has(stage) ? stage as JobApplicationStage : undefined,
    result: result && resultSet.has(result) ? result as JobApplicationResult : undefined,
  };
}
