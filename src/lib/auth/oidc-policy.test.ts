import { describe, expect, it } from 'vitest';
import { canUseExistingAccountForOidc, resolveVerifiedOidcEmail } from './oidc-policy';

describe('OIDC account policy', () => {
  it('accepts only a verified email claim', () => {
    expect(resolveVerifiedOidcEmail({
      email: ' User@Example.COM ',
      email_verified: true,
    })).toBe('user@example.com');
    expect(resolveVerifiedOidcEmail({ email: 'user@example.com', email_verified: false })).toBeNull();
    expect(resolveVerifiedOidcEmail({ email: 'user@example.com' })).toBeNull();
  });

  it('does not automatically merge OIDC into another auth type', () => {
    expect(canUseExistingAccountForOidc(null)).toBe(true);
    expect(canUseExistingAccountForOidc({ authType: 'oauth' })).toBe(true);
    expect(canUseExistingAccountForOidc({ authType: 'password' })).toBe(false);
    expect(canUseExistingAccountForOidc({ authType: 'fingerprint' })).toBe(false);
  });
});
