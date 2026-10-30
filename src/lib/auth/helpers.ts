import { auth } from './config';
import { config } from '@/lib/config';
import { dbReady } from '@/lib/db';
import { userRepository } from '@/lib/db/repositories/user.repository';

export async function getCurrentUserId(): Promise<string | null> {
  if (!config.auth.enabled) return null;

  const session = await auth();
  if (session?.user?.id) return session.user.id;

  return null;
}

export async function resolveUser(fingerprint?: string | null) {
  await dbReady;

  if (!config.auth.enabled) {
    return fingerprint ? userRepository.upsertByFingerprint(fingerprint) : null;
  }

  const session = await auth();
  if (session?.user?.id) return userRepository.findById(session.user.id);

  return null;
}

export function getUserIdFromRequest(request: Request): string | null {
  return request.headers.get('x-fingerprint') || null;
}
