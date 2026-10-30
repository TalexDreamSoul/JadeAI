import { describe, expect, it } from 'vitest';
import {
  parseJobApplicationListParams,
  parseJobApplicationPayload,
  stageForResult,
} from './job-application';

describe('job application input', () => {
  it('normalizes a complete create payload and applies defaults', () => {
    const result = parseJobApplicationPayload({
      companyName: '  Example Corp  ',
      jobTitle: '  Staff Engineer ',
      sourceUrl: 'https://example.com/jobs/42',
      appliedAt: '2026-08-23',
      resumeId: '',
    }, 'create');

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({
      companyName: 'Example Corp',
      jobTitle: 'Staff Engineer',
      stage: 'saved',
      result: 'pending',
      resumeId: null,
    });
    expect(result.data.appliedAt?.toISOString()).toBe('2026-08-23T12:00:00.000Z');
  });

  it('rejects missing required fields and unsafe source URLs', () => {
    const result = parseJobApplicationPayload({
      companyName: '',
      jobTitle: 'Engineer',
      sourceUrl: 'javascript:alert(1)',
    }, 'create');

    expect(result).toEqual(expect.objectContaining({ success: false }));
    if (result.success) return;
    expect(result.errors).toContain('Company name is required');
    expect(result.errors).toContain('Source URL must be a valid HTTP or HTTPS URL');
  });

  it('maps terminal outcomes to their canonical stages', () => {
    expect(stageForResult('offer')).toBe('offer');
    expect(stageForResult('rejected')).toBe('closed');
    expect(stageForResult('withdrawn')).toBe('closed');
    expect(stageForResult('pending')).toBeNull();

    const parsed = parseJobApplicationPayload({ result: 'rejected' }, 'patch');
    expect(parsed).toEqual({ success: true, data: { result: 'rejected', stage: 'closed' } });

    const create = parseJobApplicationPayload({
      companyName: 'Example Corp',
      jobTitle: 'Engineer',
      stage: 'interview',
      result: 'offer',
    }, 'create');
    expect(create).toEqual(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ stage: 'offer', result: 'offer' }),
    }));
  });

  it('rejects empty patches and unsupported enum values', () => {
    expect(parseJobApplicationPayload({}, 'patch')).toEqual({
      success: false,
      errors: ['No supported fields provided'],
    });
    expect(parseJobApplicationPayload({ stage: 'hired' }, 'patch')).toEqual({
      success: false,
      errors: ['Invalid application stage'],
    });
  });
});

describe('job application list filters', () => {
  it('bounds pagination and ignores unknown filters', () => {
    const params = new URLSearchParams({
      page: '-2',
      pageSize: '999',
      query: '  Example  ',
      stage: 'unknown',
      result: 'offer',
    });

    expect(parseJobApplicationListParams(params)).toEqual({
      page: 1,
      pageSize: 50,
      query: 'Example',
      stage: undefined,
      result: 'offer',
    });
  });
});
