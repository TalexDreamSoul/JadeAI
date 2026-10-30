import { describe, expect, it } from 'vitest';
import {
  LoginFailureRateLimiter,
  getPasswordLoginAttemptKey,
  type LoginRateLimitConfig,
} from './login-rate-limit';

const config: LoginRateLimitConfig = {
  maxAttempts: 2,
  windowMs: 1_000,
  maxTrackedKeys: 100,
};

describe('password login failure rate limit', () => {
  it('limits repeated failures and resets after the window', () => {
    const limiter = new LoginFailureRateLimiter();
    limiter.recordFailure('key', config, 1_000);
    expect(limiter.isLimited('key', config, 1_100)).toBe(false);

    limiter.recordFailure('key', config, 1_200);
    expect(limiter.isLimited('key', config, 1_300)).toBe(true);
    expect(limiter.isLimited('key', config, 2_001)).toBe(false);
  });

  it('clears failures after a successful login', () => {
    const limiter = new LoginFailureRateLimiter();
    limiter.recordFailure('key', config, 1_000);
    limiter.recordFailure('key', config, 1_100);
    limiter.clear('key');
    expect(limiter.isLimited('key', config, 1_200)).toBe(false);
  });

  it('uses the trusted proxy address and normalized email in its key', () => {
    const request = new Request('https://example.test', {
      headers: {
        'x-real-ip': '192.0.2.10',
        'x-forwarded-for': '198.51.100.10, 192.0.2.10',
      },
    });
    expect(getPasswordLoginAttemptKey(' User@Example.COM ', request)).toBe('192.0.2.10:user@example.com');
  });
});
