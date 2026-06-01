import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from './helpers';

export async function requireAdmin(request: NextRequest) {
  const user = await resolveUser(getUserIdFromRequest(request));
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (user.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { user };
}
