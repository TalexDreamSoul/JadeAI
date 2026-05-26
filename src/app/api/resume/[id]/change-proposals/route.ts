import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { applicableSuggestionSchema } from '@/lib/ai/jd-analysis-schema';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { analysisRepository } from '@/lib/db/repositories/analysis.repository';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import { serializeProposal } from '@/lib/change-proposals';
import type { ResumeSection } from '@/types/resume';

type ChangeProposalRecord = Parameters<typeof serializeProposal>[0];

const createSchema = z.object({
  source: z.string().optional(),
  sourceId: z.string().optional(),
  shareId: z.string().optional(),
  commentId: z.string().optional(),
  sectionId: z.string().optional(),
  suggestion: applicableSuggestionSchema,
  metadata: z.unknown().optional(),
});

async function requireOwnedResume(request: NextRequest, id: string) {
  const user = await resolveUser(getUserIdFromRequest(request));
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const resume = await resumeRepository.findById(id);
  if (!resume) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  if (resume.userId !== user.id) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { user, resume };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requireOwnedResume(request, id);
  if (result.error) return result.error;
  const proposals = await analysisRepository.findChangeProposalsByResumeId(id, 100);
  return NextResponse.json(proposals.map((proposal: unknown) => serializeProposal(proposal as ChangeProposalRecord)));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await requireOwnedResume(request, id);
    if (result.error) return result.error;

    const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
    const { suggestion } = parsed.data;
    const section = parsed.data.sectionId
      ? (result.resume!.sections as ResumeSection[]).find((item) => item.id === parsed.data.sectionId)
      : (result.resume!.sections as ResumeSection[]).find((item) => item.type === suggestion.sectionType);

    const proposal = await analysisRepository.createChangeProposal({
      resumeId: id,
      userId: result.user!.id,
      source: parsed.data.source || 'manual',
      sourceId: parsed.data.sourceId || null,
      shareId: parsed.data.shareId || null,
      commentId: parsed.data.commentId || null,
      sectionId: section?.id || parsed.data.sectionId || null,
      sectionType: suggestion.sectionType,
      targetField: suggestion.targetField,
      current: suggestion.current,
      suggested: suggestion.suggested,
      reason: suggestion.reason,
      evidenceRequired: suggestion.evidenceRequired,
      metadata: parsed.data.metadata || {},
    });
    return NextResponse.json(serializeProposal(proposal as ChangeProposalRecord), { status: 201 });
  } catch (error) {
    console.error('POST /api/resume/[id]/change-proposals error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
