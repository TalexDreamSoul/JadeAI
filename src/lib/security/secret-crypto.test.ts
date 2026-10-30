import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import {
  decryptSecret,
  encryptSecret,
  isEncryptedSecret,
  SecretEncryptionUnavailableError,
} from './secret-crypto';

describe('secret encryption', () => {
  it('encrypts with authenticated encryption and round-trips', () => {
    const key = randomBytes(32).toString('base64');
    const encrypted = encryptSecret('private-value', key);
    expect(isEncryptedSecret(encrypted)).toBe(true);
    expect(encrypted).not.toContain('private-value');
    expect(decryptSecret(encrypted, [key])).toBe('private-value');
  });

  it('rejects tampered ciphertext', () => {
    const key = randomBytes(32).toString('base64');
    const encrypted = encryptSecret('private-value', key);
    const parts = encrypted.split(':');
    const ciphertext = Buffer.from(parts[3], 'base64url');
    ciphertext[0] ^= 1;
    parts[3] = ciphertext.toString('base64url');
    const tampered = parts.join(':');
    expect(() => decryptSecret(tampered, [key])).toThrow(SecretEncryptionUnavailableError);
  });

  it('supports a previous key during rotation', () => {
    const previous = randomBytes(32).toString('base64');
    const current = randomBytes(32).toString('base64');
    const encrypted = encryptSecret('rotated-value', previous);
    expect(decryptSecret(encrypted, [current, previous])).toBe('rotated-value');
  });

  it('does not accept missing or malformed encryption keys', () => {
    expect(() => encryptSecret('private-value', undefined)).toThrow(SecretEncryptionUnavailableError);
    expect(() => encryptSecret('private-value', 'not-base64')).toThrow(SecretEncryptionUnavailableError);
  });
});
