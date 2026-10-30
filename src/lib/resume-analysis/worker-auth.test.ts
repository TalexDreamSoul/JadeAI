import { describe, expect, it } from 'vitest';
import { isResumeAnalysisWorkerAuthorized } from './worker-auth';

describe('resume analysis worker authentication', () => {
  it('fails closed when the expected token is missing', () => {
    expect(isResumeAnalysisWorkerAuthorized(undefined, null)).toBe(false);
    expect(isResumeAnalysisWorkerAuthorized(undefined, 'provided')).toBe(false);
    expect(isResumeAnalysisWorkerAuthorized('', '')).toBe(false);
  });

  it('requires an exact token match', () => {
    expect(isResumeAnalysisWorkerAuthorized('expected-token', 'expected-token')).toBe(true);
    expect(isResumeAnalysisWorkerAuthorized('expected-token', 'wrong-token')).toBe(false);
  });
});
