import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { applicableSuggestionSchema } from '@/lib/ai/jd-analysis-schema';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { buildSuggestionUpdate } from '@/lib/career/suggestion-application';
import { applyChangeProposal } from '@/lib/change-proposals';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';

const inputSchema = z.object({
  resumeId: z.string().min(1),
  suggestion: applicableSuggestionSchema.optional(),
  proposalId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = inputSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
    }

    const { resumeId, suggestion, proposalId } = parsed.data;
    const resume = await resumeRepository.findById(resumeId);
    if (!resume) return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    if (resume.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if (proposalId) {
      const applied = await applyChangeProposal(proposalId, user.id);
      return NextResponse.json({ resume: applied.resume, sectionId: applied.sectionId, proposal: applied.proposal, previousContent: null });
    }

    if (!suggestion) return NextResponse.json({ error: 'suggestion is required' }, { status: 400 });

    const before = resume;
    let update;
    try {
      update = buildSuggestionUpdate(resume, suggestion);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to apply suggestion';
      const status = message === 'Target section not found'
        ? 404
        : message === 'Original content not found, skipped to avoid adding duplicate content'
          ? 409
          : 400;
      return NextResponse.json({ error: message }, { status });
    }

    await resumeRepository.updateSection(update.section.id, { content: update.nextContent });
    const updated = await resumeRepository.findById(resumeId);
    if (updated) {
      await resumeRepository.createVersion(resumeId, `career-apply-before-${Date.now()}`, before, 'jd').catch(() => null);
      await resumeRepository.createVersion(resumeId, `career-apply-after-${Date.now()}`, updated, 'jd').catch(() => null);
      await resumeRepository.createEvent({
        resumeId,
        userId: user.id,
        type: 'career.suggestion_applied',
        title: 'JD suggestion applied',
        description: suggestion.reason,
        metadata: { suggestion },
      }).catch(() => null);
    }

    return NextResponse.json({ resume: updated, sectionId: update.section.id, previousContent: update.previousContent });
  } catch (error) {
    console.error('POST /api/career/apply-suggestion error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
