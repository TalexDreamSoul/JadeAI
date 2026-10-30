import { timingSafeEqual } from 'node:crypto';

export function isResumeAnalysisWorkerAuthorized(
  expectedToken: string | undefined,
  providedToken: string | null,
): boolean {
  if (!expectedToken || !providedToken) return false;

  const expected = Buffer.from(expectedToken);
  const provided = Buffer.from(providedToken);
  if (expected.length !== provided.length) return false;

  return timingSafeEqual(expected, provided);
}
