import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const PREFIX = 'enc:v1';
const AAD = Buffer.from('jadeai:secret:v1', 'utf8');

export class SecretEncryptionUnavailableError extends Error {
  constructor(message = 'DATA_ENCRYPTION_KEY must be a base64-encoded 32-byte key') {
    super(message);
    this.name = 'SecretEncryptionUnavailableError';
  }
}

function parseKey(value: string | undefined): Buffer {
  if (!value) throw new SecretEncryptionUnavailableError();
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32 || key.toString('base64').replace(/=+$/, '') !== value.trim().replace(/=+$/, '')) {
    throw new SecretEncryptionUnavailableError();
  }
  return key;
}

export function isEncryptedSecret(value: string): boolean {
  return value.startsWith(`${PREFIX}:`);
}

export function canEncryptSecrets(keyValue = process.env.DATA_ENCRYPTION_KEY): boolean {
  try {
    parseKey(keyValue);
    return true;
  } catch {
    return false;
  }
}

export function encryptSecret(value: string, keyValue = process.env.DATA_ENCRYPTION_KEY): string {
  if (!value || isEncryptedSecret(value)) return value;
  const key = parseKey(keyValue);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(AAD);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString('base64url'), ciphertext.toString('base64url'), tag.toString('base64url')].join(':');
}

export function decryptSecret(
  value: string,
  keyValues: Array<string | undefined> = [
    process.env.DATA_ENCRYPTION_KEY,
    process.env.DATA_ENCRYPTION_KEY_PREVIOUS,
  ],
): string {
  if (!value || !isEncryptedSecret(value)) return value;
  const [, version, encodedIv, encodedCiphertext, encodedTag] = value.split(':');
  if (version !== 'v1' || !encodedIv || !encodedCiphertext || !encodedTag) {
    throw new Error('Invalid encrypted secret envelope');
  }

  let lastError: unknown;
  for (const keyValue of keyValues) {
    if (!keyValue) continue;
    try {
      const decipher = createDecipheriv('aes-256-gcm', parseKey(keyValue), Buffer.from(encodedIv, 'base64url'));
      decipher.setAAD(AAD);
      decipher.setAuthTag(Buffer.from(encodedTag, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(encodedCiphertext, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch (error) {
      lastError = error;
    }
  }

  throw new SecretEncryptionUnavailableError(
    lastError ? 'Unable to decrypt stored secret with the configured encryption keys' : undefined,
  );
}
