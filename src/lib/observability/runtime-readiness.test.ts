import { describe, expect, it } from 'vitest';
import { getRuntimeConfigurationIssues } from './runtime-readiness';

describe('runtime readiness configuration', () => {
  it('requires a non-placeholder auth secret in production', () => {
    expect(getRuntimeConfigurationIssues({ NODE_ENV: 'production', AUTH_SECRET: undefined }))
      .toEqual(['AUTH_SECRET', 'DATA_ENCRYPTION_KEY']);
    expect(getRuntimeConfigurationIssues({
      NODE_ENV: 'production',
      AUTH_SECRET: 'your-auth-secret-key-change-me',
    })).toEqual(['AUTH_SECRET', 'DATA_ENCRYPTION_KEY']);
    expect(getRuntimeConfigurationIssues({
      NODE_ENV: 'production',
      AUTH_SECRET: 'change-me-use-openssl-rand-base64-32',
    })).toEqual(['AUTH_SECRET', 'DATA_ENCRYPTION_KEY']);
    expect(getRuntimeConfigurationIssues({ NODE_ENV: 'production', AUTH_SECRET: 'too-short' }))
      .toEqual(['AUTH_SECRET', 'DATA_ENCRYPTION_KEY']);
  });

  it('accepts sufficiently strong production secrets', () => {
    expect(getRuntimeConfigurationIssues({
      NODE_ENV: 'production',
      AUTH_SECRET: 'a-secure-random-secret-with-32-characters',
      DATA_ENCRYPTION_KEY: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
    })).toEqual([]);
  });

  it('rejects a malformed data encryption key', () => {
    expect(getRuntimeConfigurationIssues({
      NODE_ENV: 'production',
      AUTH_SECRET: 'a-secure-random-secret-with-32-characters',
      DATA_ENCRYPTION_KEY: 'not-base64-32-bytes',
    })).toEqual(['DATA_ENCRYPTION_KEY']);
  });

  it('does not require an explicit secret in development', () => {
    expect(getRuntimeConfigurationIssues({ NODE_ENV: 'development', AUTH_SECRET: undefined }))
      .toEqual([]);
  });
});
