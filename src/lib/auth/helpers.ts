import { auth } from './config';
import { dbReady } from '@/lib/db';
import { userRepository } from '@/lib/db/repositories/user.repository';

export async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id || null;
}

export async function resolveUser(_fingerprint?: string | null) {
  await dbReady;

  const session = await auth();
  if (session?.user?.id && session.user.email) {
    let user = await userRepository.findById(session.user.id);

    if (!user) {
      user = await userRepository.findByEmail(session.user.email);
    }

    return user;
  }

  return null;
}

export function getUserIdFromRequest(_request: Request): string | null {
  return null;
}
