import { describe, expect, it } from 'vitest';
import {
  buildDesktopStartUrl,
  isSafeCheckoutNavigation,
  isSafeExternalNavigation,
  isTrustedInAppNavigation,
  normalizeRemoteUrl,
  resolveDesktopMode,
} from './runtime-policy';

describe('desktop runtime policy', () => {
  it('uses a remote backend for packaged applications and local mode for development', () => {
    expect(resolveDesktopMode(undefined, true)).toBe('remote');
    expect(resolveDesktopMode(undefined, false)).toBe('local');
  });

  it('requires HTTPS for packaged non-loopback remote URLs', () => {
    expect(() => normalizeRemoteUrl('http://jade.example.com', true)).toThrow('requires HTTPS');
    expect(normalizeRemoteUrl('https://jade.example.com/path?token=secret#hash', true).toString())
      .toBe('https://jade.example.com/path');
    expect(normalizeRemoteUrl('http://127.0.0.1:3000', true).origin).toBe('http://127.0.0.1:3000');
  });

  it('keeps in-app navigation on the configured origin', () => {
    const base = normalizeRemoteUrl('https://jade.example.com', true);
    expect(buildDesktopStartUrl(base, '/zh')).toBe('https://jade.example.com/zh');
    expect(isTrustedInAppNavigation('https://jade.example.com/zh/account', base.origin)).toBe(true);
    expect(isTrustedInAppNavigation('https://checkout.example.com', base.origin)).toBe(false);
  });

  it('only opens conventional web and mail links externally', () => {
    expect(isSafeExternalNavigation('https://example.com')).toBe(true);
    expect(isSafeExternalNavigation('mailto:help@example.com')).toBe(true);
    expect(isSafeExternalNavigation('javascript:alert(1)')).toBe(false);
    expect(isSafeExternalNavigation('file:///tmp/private')).toBe(false);
  });

  it('restricts embedded checkout navigation to HTTPS or development loopback', () => {
    expect(isSafeCheckoutNavigation('https://checkout.stripe.com/c/pay/cs_test_1', true)).toBe(true);
    expect(isSafeCheckoutNavigation('https://user:secret@example.com/pay', true)).toBe(false);
    expect(isSafeCheckoutNavigation('http://127.0.0.1:4242/checkout', false)).toBe(true);
    expect(isSafeCheckoutNavigation('http://127.0.0.1:4242/checkout', true)).toBe(false);
    expect(isSafeCheckoutNavigation('javascript:alert(1)', false)).toBe(false);
  });
});
