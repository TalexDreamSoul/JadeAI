import { normalizeEmail } from './password';

export type OidcIdentityProfile = {
  email?: string | null;
  email_verified?: boolean;
};

export function resolveVerifiedOidcEmail(
  profile: OidcIdentityProfile | undefined,
  fallbackEmail?: string | null,
): string | null {
  if (profile?.email_verified !== true) return null;

  const email = normalizeEmail(profile.email || fallbackEmail || '');
  return email.includes('@') ? email : null;
}

export function canUseExistingAccountForOidc(
  existing: { authType?: string | null } | null,
): boolean {
  return !existing || existing.authType === 'oauth';
}
