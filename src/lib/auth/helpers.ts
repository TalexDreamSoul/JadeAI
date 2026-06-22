import { auth } from './config';
import { config } from '@/lib/config';
import { dbReady } from '@/lib/db';
import { userRepository } from '@/lib/db/repositories/user.repository';

export async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  if (session?.user?.id) return session.user.id;

  return null;
}

export async function resolveUser(fingerprint?: string | null) {
  await dbReady;

  const session = await auth();
  if (session?.user?.id && session.user.email) {
    let user = await userRepository.findById(session.user.id);

    if (!user) {
      user = await userRepository.findByEmail(session.user.email);
    }

    return user;
  }

  if (!config.auth.enabled && fingerprint) {
    return userRepository.upsertByFingerprint(fingerprint);
  }

  return null;
}

export function getUserIdFromRequest(request: Request): string | null {
  return request.headers.get('x-fingerprint') || null;
}
