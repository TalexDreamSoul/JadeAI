import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { listJobApplicationOptions } from '@/lib/career/job-application-service';

export async function GET(request: NextRequest) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    return NextResponse.json(await listJobApplicationOptions(user.id));
  } catch (error) {
    console.error('GET /api/career/applications/options error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
