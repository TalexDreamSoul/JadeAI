import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { parseJobApplicationPayload } from '@/lib/career/job-application';
import {
  InvalidJobApplicationRelationError,
  updateJobApplication,
} from '@/lib/career/job-application-service';
import { jobApplicationRepository } from '@/lib/db/repositories/job-application.repository';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const application = await jobApplicationRepository.findByIdForUser((await params).id, user.id);
    if (!application) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(application);
  } catch (error) {
    console.error('GET /api/career/applications/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = parseJobApplicationPayload(await request.json().catch(() => ({})), 'patch');
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.errors[0], errors: parsed.errors }, { status: 400 });
    }

    const application = await updateJobApplication((await params).id, user.id, parsed.data);
    if (!application) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(application);
  } catch (error) {
    if (error instanceof InvalidJobApplicationRelationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('PATCH /api/career/applications/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const deleted = await jobApplicationRepository.delete((await params).id, user.id);
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('DELETE /api/career/applications/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
