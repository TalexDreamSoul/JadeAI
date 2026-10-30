import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  config: { auth: { enabled: false } },
  findById: vi.fn(),
  upsertByFingerprint: vi.fn(),
}));

vi.mock('./config', () => ({ auth: mocks.auth }));
vi.mock('@/lib/config', () => ({ config: mocks.config }));
vi.mock('@/lib/db', () => ({ dbReady: Promise.resolve() }));
vi.mock('@/lib/db/repositories/user.repository', () => ({
  userRepository: {
    findById: mocks.findById,
    upsertByFingerprint: mocks.upsertByFingerprint,
  },
}));

import { getCurrentUserId, resolveUser } from './helpers';

afterEach(() => {
  mocks.auth.mockReset();
  mocks.findById.mockReset();
  mocks.upsertByFingerprint.mockReset();
  mocks.config.auth.enabled = false;
});

describe('authentication helpers', () => {
  it('resolves a fingerprint without entering Auth.js when auth is disabled', async () => {
    const user = { id: 'fingerprint-user' };
    mocks.upsertByFingerprint.mockResolvedValue(user);

    await expect(resolveUser('fingerprint-user')).resolves.toBe(user);
    await expect(getCurrentUserId()).resolves.toBeNull();
    expect(mocks.auth).not.toHaveBeenCalled();
  });

  it('uses only the authenticated user id when auth is enabled', async () => {
    mocks.config.auth.enabled = true;
    mocks.auth.mockResolvedValue({ user: { id: 'session-user', email: 'user@example.com' } });
    mocks.findById.mockResolvedValue({ id: 'session-user' });

    await expect(resolveUser('ignored-fingerprint')).resolves.toEqual({ id: 'session-user' });
    await expect(getCurrentUserId()).resolves.toBe('session-user');
    expect(mocks.findById).toHaveBeenCalledWith('session-user');
    expect(mocks.upsertByFingerprint).not.toHaveBeenCalled();
  });

  it('does not trust a fingerprint when auth is enabled without a session', async () => {
    mocks.config.auth.enabled = true;
    mocks.auth.mockResolvedValue(null);

    await expect(resolveUser('untrusted-fingerprint')).resolves.toBeNull();
    expect(mocks.upsertByFingerprint).not.toHaveBeenCalled();
  });
});
