import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import {
  parseJobApplicationListParams,
  parseJobApplicationPayload,
} from '@/lib/career/job-application';
import {
  createJobApplication,
  InvalidJobApplicationRelationError,
} from '@/lib/career/job-application-service';
import { jobApplicationRepository } from '@/lib/db/repositories/job-application.repository';

export async function GET(request: NextRequest) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const filters = parseJobApplicationListParams(request.nextUrl.searchParams);
    const result = await jobApplicationRepository.list({ userId: user.id, ...filters });
    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/career/applications error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = parseJobApplicationPayload(await request.json().catch(() => ({})), 'create');
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.errors[0], errors: parsed.errors }, { status: 400 });
    }

    const application = await createJobApplication(user.id, parsed.data);
    return NextResponse.json(application, { status: 201 });
  } catch (error) {
    if (error instanceof InvalidJobApplicationRelationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('POST /api/career/applications error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
