import type { NextRequest } from 'next/server';
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const SCRYPT_PREFIX = 'scrypt:v1';

export function generateShareToken(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

export function getShareUrl(token: string, request: NextRequest): string {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const origin = host ? `${proto}://${host}` : request.nextUrl.origin;
  return `${origin}/share/${token}`;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 32) as Buffer;
  return `${SCRYPT_PREFIX}:${salt.toString('base64url')}:${derived.toString('base64url')}`;
}

export function isLegacyPasswordHash(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (isLegacyPasswordHash(storedHash)) {
    const actual = createHash('sha256').update(password).digest();
    const expected = Buffer.from(storedHash, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  const [algorithm, version, encodedSalt, encodedHash] = storedHash.split(':');
  if (`${algorithm}:${version}` !== SCRYPT_PREFIX || !encodedSalt || !encodedHash) return false;
  try {
    const expected = Buffer.from(encodedHash, 'base64url');
    const actual = await scrypt(password, Buffer.from(encodedSalt, 'base64url'), expected.length) as Buffer;
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
