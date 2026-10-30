import { createHash } from 'node:crypto';

export const PRODUCT_EVENT_NAMES = [
  'resume_imported',
  'resume_created',
  'jd_analyzed',
  'tailored_resume_created',
  'resume_exported',
  'mock_interview_started',
  'mock_interview_completed',
  'application_created',
  'application_result_recorded',
  'checkout_started',
  'payment_succeeded',
] as const;

export type ProductEventName = typeof PRODUCT_EVENT_NAMES[number];
export type ProductEventMetadata = Record<string, string | number | boolean>;
export type ParsedProductEvent = {
  eventName: ProductEventName;
  metadata: ProductEventMetadata;
};

type StringRule = {
  type: 'string';
  maxLength: number;
  values?: readonly string[];
  pattern?: RegExp;
};
type NumberRule = { type: 'number'; min: number; max: number; integer?: boolean };
type BooleanRule = { type: 'boolean' };
type MetadataRule = StringRule | NumberRule | BooleanRule;

const idRule: StringRule = {
  type: 'string',
  maxLength: 160,
  pattern: /^[a-zA-Z0-9:_-]+$/,
};
const slugRule: StringRule = {
  type: 'string',
  maxLength: 64,
  pattern: /^[a-zA-Z0-9._-]+$/,
};
const scoreRule: NumberRule = { type: 'number', min: 0, max: 100, integer: true };
const countRule: NumberRule = { type: 'number', min: 0, max: 1_000, integer: true };
const amountRule: NumberRule = { type: 'number', min: 0, max: 1_000_000_000, integer: true };

const METADATA_RULES: Record<ProductEventName, Record<string, MetadataRule>> = {
  resume_imported: {
    resumeId: idRule,
    source: { type: 'string', maxLength: 32, values: ['file_parse', 'json', 'local_sync'] },
    format: { type: 'string', maxLength: 16, values: ['pdf', 'image', 'json', 'local'] },
    template: slugRule,
    language: slugRule,
  },
  resume_created: {
    resumeId: idRule,
    source: { type: 'string', maxLength: 32, values: ['blank', 'generated'] },
    template: slugRule,
    language: slugRule,
  },
  jd_analyzed: {
    resumeId: idRule,
    analysisId: idRule,
    source: { type: 'string', maxLength: 16, values: ['cloud', 'local'] },
    overallScore: scoreRule,
    atsScore: scoreRule,
  },
  tailored_resume_created: {
    sourceResumeId: idRule,
    derivedResumeId: idRule,
    tailored: { type: 'boolean' },
  },
  resume_exported: {
    resumeId: idRule,
    format: { type: 'string', maxLength: 16, values: ['json', 'html', 'txt', 'docx', 'pdf'] },
    fitOnePage: { type: 'boolean' },
  },
  mock_interview_started: {
    interviewSessionId: idRule,
    resumeId: idRule,
    interviewerCount: countRule,
  },
  mock_interview_completed: {
    interviewSessionId: idRule,
    roundCount: countRule,
  },
  application_created: {
    applicationId: idRule,
    stage: { type: 'string', maxLength: 24, values: ['saved', 'applied', 'screening', 'interview', 'offer', 'closed'] },
    hasResume: { type: 'boolean' },
    hasJdAnalysis: { type: 'boolean' },
    hasInterview: { type: 'boolean' },
  },
  application_result_recorded: {
    applicationId: idRule,
    stage: { type: 'string', maxLength: 24, values: ['saved', 'applied', 'screening', 'interview', 'offer', 'closed'] },
    result: { type: 'string', maxLength: 24, values: ['offer', 'rejected', 'withdrawn', 'no_response'] },
  },
  checkout_started: {
    orderId: idRule,
    provider: slugRule,
    amountCents: amountRule,
    currency: { type: 'string', maxLength: 8, pattern: /^[A-Z]{3,8}$/ },
  },
  payment_succeeded: {
    orderId: idRule,
    provider: slugRule,
    amountCents: amountRule,
    currency: { type: 'string', maxLength: 8, pattern: /^[A-Z]{3,8}$/ },
  },
};

const eventNameSet = new Set<string>(PRODUCT_EVENT_NAMES);
const MAX_BATCH_SIZE = 20;
const MAX_METADATA_BYTES = 2_048;
const MAX_FINGERPRINT_LENGTH = 512;

export class ProductEventValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductEventValidationError';
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function validateMetadataValue(key: string, value: unknown, rule: MetadataRule) {
  if (rule.type === 'boolean') {
    if (typeof value !== 'boolean') throw new ProductEventValidationError(`metadata.${key} must be a boolean`);
    return value;
  }

  if (rule.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new ProductEventValidationError(`metadata.${key} must be a finite number`);
    }
    if (rule.integer && !Number.isInteger(value)) {
      throw new ProductEventValidationError(`metadata.${key} must be an integer`);
    }
    if (value < rule.min || value > rule.max) {
      throw new ProductEventValidationError(`metadata.${key} is out of range`);
    }
    return value;
  }

  if (typeof value !== 'string') throw new ProductEventValidationError(`metadata.${key} must be a string`);
  const normalized = value.trim();
  if (!normalized || normalized.length > rule.maxLength) {
    throw new ProductEventValidationError(`metadata.${key} has an invalid length`);
  }
  if (rule.values && !rule.values.includes(normalized)) {
    throw new ProductEventValidationError(`metadata.${key} has an unsupported value`);
  }
  if (rule.pattern && !rule.pattern.test(normalized)) {
    throw new ProductEventValidationError(`metadata.${key} has an invalid format`);
  }
  return normalized;
}

export function parseProductEvent(value: unknown): ParsedProductEvent {
  const input = asRecord(value);
  if (!input) throw new ProductEventValidationError('event must be an object');

  const unknownEventFields = Object.keys(input).filter((key) => key !== 'eventName' && key !== 'metadata');
  if (unknownEventFields.length > 0) throw new ProductEventValidationError(`unsupported event field: ${unknownEventFields[0]}`);

  const eventName = typeof input.eventName === 'string' ? input.eventName.trim() : '';
  if (!eventNameSet.has(eventName)) throw new ProductEventValidationError('unsupported eventName');

  const metadataInput = input.metadata === undefined ? {} : asRecord(input.metadata);
  if (!metadataInput) throw new ProductEventValidationError('metadata must be a flat object');

  const rules = METADATA_RULES[eventName as ProductEventName];
  const metadata: ProductEventMetadata = {};
  for (const [key, item] of Object.entries(metadataInput)) {
    const rule = rules[key];
    if (!rule) throw new ProductEventValidationError(`unsupported metadata field: ${key}`);
    metadata[key] = validateMetadataValue(key, item, rule);
  }

  if (new TextEncoder().encode(JSON.stringify(metadata)).byteLength > MAX_METADATA_BYTES) {
    throw new ProductEventValidationError('metadata is too large');
  }

  return { eventName: eventName as ProductEventName, metadata };
}

export function parseProductEventBatch(value: unknown): ParsedProductEvent[] {
  let values: unknown[];
  if (Array.isArray(value)) {
    values = value;
  } else {
    const record = asRecord(value);
    if (record && 'events' in record) {
      const unknownWrapperFields = Object.keys(record).filter((key) => key !== 'events');
      if (unknownWrapperFields.length > 0) {
        throw new ProductEventValidationError(`unsupported batch field: ${unknownWrapperFields[0]}`);
      }
      if (!Array.isArray(record.events)) throw new ProductEventValidationError('events must be an array');
      values = record.events;
    } else {
      values = [value];
    }
  }

  if (values.length === 0) throw new ProductEventValidationError('at least one event is required');
  if (values.length > MAX_BATCH_SIZE) {
    throw new ProductEventValidationError(`event batch cannot exceed ${MAX_BATCH_SIZE} items`);
  }

  return values.map((item, index) => {
    try {
      return parseProductEvent(item);
    } catch (error) {
      if (error instanceof ProductEventValidationError) {
        throw new ProductEventValidationError(`events[${index}]: ${error.message}`);
      }
      throw error;
    }
  });
}

export function normalizeProductEventFingerprint(value: string | null | undefined) {
  const fingerprint = value?.trim() || '';
  if (!fingerprint) return null;
  if (fingerprint.length < 8 || fingerprint.length > MAX_FINGERPRINT_LENGTH) {
    throw new ProductEventValidationError('fingerprint has an invalid length');
  }
  return fingerprint;
}

export function hashAnonymousFingerprint(fingerprint: string) {
  return createHash('sha256')
    .update(`jadeai-product-event:${fingerprint}`, 'utf8')
    .digest('hex');
}

type RateLimitBucket = { count: number; resetAt: number };

export class ProductEventRateLimiter {
  private readonly buckets = new Map<string, RateLimitBucket>();

  constructor(
    private readonly limit = 60,
    private readonly windowMs = 60_000,
  ) {}

  consume(key: string, amount: number, now = Date.now()) {
    const current = this.buckets.get(key);
    const bucket = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + this.windowMs }
      : current;
    const allowed = bucket.count + amount <= this.limit;
    if (allowed) bucket.count += amount;
    this.buckets.set(key, bucket);

    if (this.buckets.size > 10_000) {
      for (const [bucketKey, value] of this.buckets) {
        if (value.resetAt <= now) this.buckets.delete(bucketKey);
      }
    }

    return {
      allowed,
      remaining: Math.max(0, this.limit - bucket.count),
      retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000)),
    };
  }
}

export const productEventRateLimiter = new ProductEventRateLimiter();
