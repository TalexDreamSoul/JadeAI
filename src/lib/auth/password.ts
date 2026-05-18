const ITERATIONS = 210_000;
const KEY_LENGTH = 32;
const DIGEST = 'SHA-256';

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(Buffer.from(value, 'base64')) as Uint8Array<ArrayBuffer>;
}

async function derive(password: string, salt: Uint8Array<ArrayBuffer>): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: DIGEST },
    keyMaterial,
    KEY_LENGTH * 8
  );
  return toBase64(new Uint8Array(bits));
}

export async function hashPasswordForAuth(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16)) as Uint8Array<ArrayBuffer>;
  const hash = await derive(password, salt);
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${hash}`;
}

export async function verifyPasswordForAuth(password: string, storedHash: string | null | undefined): Promise<boolean> {
  if (!storedHash) return false;
  const parts = storedHash.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;

  const [, iterations, saltRaw, expected] = parts;
  if (Number(iterations) !== ITERATIONS) return false;

  const actual = await derive(password, fromBase64(saltRaw));
  return actual === expected;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
