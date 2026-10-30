import { describe, expect, it } from 'vitest';
import {
  ProductEventRateLimiter,
  ProductEventValidationError,
  hashAnonymousFingerprint,
  parseProductEventBatch,
} from './product-event';
import { buildProductFunnels } from './product-funnel';

describe('product events', () => {
  it('accepts single and bounded batch payloads', () => {
    expect(parseProductEventBatch({
      eventName: 'resume_exported',
      metadata: { resumeId: 'resume-1', format: 'pdf', fitOnePage: true },
    })).toHaveLength(1);
    expect(parseProductEventBatch({
      events: [
        { eventName: 'resume_created', metadata: { source: 'blank' } },
        { eventName: 'checkout_started', metadata: { orderId: 'order-1', provider: 'stripe', amountCents: 9900, currency: 'CNY' } },
      ],
    })).toHaveLength(2);
  });

  it('rejects unknown events and metadata that could carry content', () => {
    expect(() => parseProductEventBatch({ eventName: 'page_viewed' })).toThrow(ProductEventValidationError);
    expect(() => parseProductEventBatch({
      eventName: 'jd_analyzed',
      metadata: { jobDescription: 'private JD body' },
    })).toThrow('unsupported metadata field');
    expect(() => parseProductEventBatch({
      eventName: 'resume_created',
      metadata: { source: { nested: true } },
    })).toThrow(ProductEventValidationError);
  });

  it('hashes anonymous fingerprints deterministically without retaining the source', () => {
    const fingerprint = 'visitor-12345678';
    const first = hashAnonymousFingerprint(fingerprint);
    expect(first).toBe(hashAnonymousFingerprint(fingerprint));
    expect(first).toHaveLength(64);
    expect(first).not.toContain(fingerprint);
  });

  it('applies event counts to a fixed-window actor limit', () => {
    const limiter = new ProductEventRateLimiter(3, 1_000);
    expect(limiter.consume('actor', 2, 0)).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.consume('actor', 2, 100)).toMatchObject({ allowed: false, remaining: 1 });
    expect(limiter.consume('actor', 2, 1_000)).toMatchObject({ allowed: true, remaining: 1 });
  });
});

describe('product funnel', () => {
  it('uses a cumulative cohort so later-only actors cannot inflate conversion', () => {
    const result = buildProductFunnels([
      { eventName: 'resume_created', userId: 'user-a', anonymousId: null, firstOccurredAt: new Date('2026-08-01T00:00:00Z') },
      { eventName: 'resume_imported', userId: 'user-b', anonymousId: null, firstOccurredAt: 1_775_001_600 },
      { eventName: 'jd_analyzed', userId: 'user-b', anonymousId: null, firstOccurredAt: '2026-04-01T01:00:00Z' },
      { eventName: 'jd_analyzed', userId: 'user-c', anonymousId: null, firstOccurredAt: '2026-04-01T01:00:00Z' },
      { eventName: 'tailored_resume_created', userId: 'user-b', anonymousId: null, firstOccurredAt: 1_775_008_800_000 },
      { eventName: 'resume_exported', userId: 'user-c', anonymousId: null, firstOccurredAt: 1_775_012_400 },
      { eventName: 'checkout_started', userId: 'buyer-a', anonymousId: null, firstOccurredAt: 1_775_001_600 },
      { eventName: 'payment_succeeded', userId: 'buyer-a', anonymousId: null, firstOccurredAt: 1_775_005_200 },
      { eventName: 'payment_succeeded', userId: 'buyer-b', anonymousId: null, firstOccurredAt: 1_775_005_200 },
    ]);

    const career = result.funnels.find((funnel) => funnel.key === 'career')!;
    expect(career.steps.slice(0, 4).map((step) => step.actors)).toEqual([2, 1, 1, 0]);
    expect(career.steps.every((step) => step.conversionFromPrevious === null || step.conversionFromPrevious <= 100)).toBe(true);

    const commerce = result.funnels.find((funnel) => funnel.key === 'commerce')!;
    expect(commerce.steps.map((step) => step.actors)).toEqual([1, 1]);
    expect(commerce.steps[1].conversionFromPrevious).toBe(100);
  });

  it('does not count an export that happened before the resume was created', () => {
    const result = buildProductFunnels([
      { eventName: 'resume_exported', userId: 'user-a', anonymousId: null, firstOccurredAt: 100 },
      { eventName: 'resume_created', userId: 'user-a', anonymousId: null, firstOccurredAt: 200 },
      { eventName: 'jd_analyzed', userId: 'user-a', anonymousId: null, firstOccurredAt: 300 },
      { eventName: 'tailored_resume_created', userId: 'user-a', anonymousId: null, firstOccurredAt: 400 },
    ]);

    const career = result.funnels.find((funnel) => funnel.key === 'career')!;
    expect(career.steps.slice(0, 4).map((step) => step.actors)).toEqual([1, 1, 1, 0]);
  });
});
