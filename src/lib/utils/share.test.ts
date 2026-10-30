import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hashPassword, isLegacyPasswordHash, verifyPassword } from './share';

describe('share password hashing', () => {
  it('uses a random salt and verifies the password', async () => {
    const first = await hashPassword('correct horse battery staple');
    const second = await hashPassword('correct horse battery staple');
    expect(first).not.toBe(second);
    expect(first.startsWith('scrypt:v1:')).toBe(true);
    expect(await verifyPassword('correct horse battery staple', first)).toBe(true);
    expect(await verifyPassword('wrong password', first)).toBe(false);
  });

  it('verifies legacy SHA-256 hashes for migration', async () => {
    const legacy = createHash('sha256').update('legacy-password').digest('hex');
    expect(isLegacyPasswordHash(legacy)).toBe(true);
    expect(await verifyPassword('legacy-password', legacy)).toBe(true);
    expect(await verifyPassword('wrong', legacy)).toBe(false);
  });
});
