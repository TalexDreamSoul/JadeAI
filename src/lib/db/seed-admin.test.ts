import { describe, expect, it } from 'vitest';
import { resolveAdminSeedCredentials } from './seed-admin';

describe('administrator seed credentials', () => {
  it('skips automatic administrator creation without an explicit password', () => {
    expect(resolveAdminSeedCredentials({ ADMIN_EMAIL: undefined, ADMIN_PASSWORD: undefined })).toBeNull();
  });

  it('rejects weak bootstrap passwords', () => {
    expect(() => resolveAdminSeedCredentials({
      ADMIN_EMAIL: 'admin@example.com',
      ADMIN_PASSWORD: 'too-short',
    })).toThrow('ADMIN_PASSWORD must be at least 12 characters');
  });

  it('normalizes the email without changing the supplied password', () => {
    expect(resolveAdminSeedCredentials({
      ADMIN_EMAIL: ' Admin@Example.COM ',
      ADMIN_PASSWORD: 'correct horse battery staple',
    })).toEqual({
      email: 'admin@example.com',
      password: 'correct horse battery staple',
    });
  });
});
