import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  resolveUser: vi.fn(),
  list: vi.fn(),
  findByIdForUser: vi.fn(),
  remove: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@/lib/auth/helpers', () => ({
  getUserIdFromRequest: vi.fn(() => 'fingerprint'),
  resolveUser: mocks.resolveUser,
}));

vi.mock('@/lib/db/repositories/job-application.repository', () => ({
  jobApplicationRepository: {
    list: mocks.list,
    findByIdForUser: mocks.findByIdForUser,
    delete: mocks.remove,
  },
}));

vi.mock('@/lib/career/job-application-service', () => ({
  InvalidJobApplicationRelationError: class InvalidJobApplicationRelationError extends Error {},
  createJobApplication: mocks.create,
  updateJobApplication: mocks.update,
}));

import { GET as listApplications } from '@/app/api/career/applications/route';
import { GET as getApplication } from '@/app/api/career/applications/[id]/route';

describe('job application API authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveUser.mockResolvedValue({ id: 'user-a' });
  });

  it('rejects unauthenticated list requests before repository access', async () => {
    mocks.resolveUser.mockResolvedValue(null);
    const response = await listApplications(new NextRequest('http://localhost/api/career/applications'));

    expect(response.status).toBe(401);
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it('always scopes list filters to the resolved user', async () => {
    mocks.list.mockResolvedValue({ items: [], page: 2, pageSize: 20, total: 0, totalPages: 1 });
    const request = new NextRequest('http://localhost/api/career/applications?page=2&pageSize=20&stage=applied');
    const response = await listApplications(request);

    expect(response.status).toBe(200);
    expect(mocks.list).toHaveBeenCalledWith({
      userId: 'user-a',
      page: 2,
      pageSize: 20,
      query: '',
      stage: 'applied',
      result: undefined,
    });
  });

  it('hides missing or cross-user records behind a 404 response', async () => {
    mocks.findByIdForUser.mockResolvedValue(null);
    const request = new NextRequest('http://localhost/api/career/applications/application-b');
    const response = await getApplication(request, { params: Promise.resolve({ id: 'application-b' }) });

    expect(response.status).toBe(404);
    expect(mocks.findByIdForUser).toHaveBeenCalledWith('application-b', 'user-a');
  });
});
