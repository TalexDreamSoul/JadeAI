import { createHash } from 'crypto';

export function normalizeJdText(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .trim()
    .toLowerCase();
}

export function hashJdText(value: string) {
  return createHash('sha256').update(normalizeJdText(value)).digest('hex');
}

export function shortJdHash(value: string) {
  return hashJdText(value).slice(0, 16);
}
