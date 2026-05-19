import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import type { ResumeSection } from '@/types/resume';

const inputSchema = z.object({
  resumeId: z.string().min(1),
  sectionId: z.string().min(1),
  content: z.unknown(),
  reason: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = inputSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
    }

    const { resumeId, sectionId, content, reason } = parsed.data;
    const resume = await resumeRepository.findById(resumeId);
    if (!resume) return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    if (resume.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const section = (resume.sections as ResumeSection[]).find((item) => item.id === sectionId);
    if (!section) return NextResponse.json({ error: 'Section not found' }, { status: 404 });

    await resumeRepository.updateSection(sectionId, { content });
    const updated = await resumeRepository.findById(resumeId);
    if (updated) {
      await resumeRepository.createVersion(resumeId, `career-undo-${Date.now()}`, updated, 'jd').catch(() => null);
      await resumeRepository.createEvent({
        resumeId,
        userId: user.id,
        type: 'career.suggestion_undone',
        title: 'JD suggestion undone',
        description: reason || '',
        metadata: { sectionId },
      }).catch(() => null);
    }

    return NextResponse.json({ resume: updated, sectionId });
  } catch (error) {
    console.error('POST /api/career/restore-section error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

