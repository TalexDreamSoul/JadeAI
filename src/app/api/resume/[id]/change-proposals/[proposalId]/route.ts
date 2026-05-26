import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { analysisRepository } from '@/lib/db/repositories/analysis.repository';
import { applyChangeProposal, rejectChangeProposal, serializeProposal, undoChangeProposal } from '@/lib/change-proposals';

type ChangeProposalRecord = Parameters<typeof serializeProposal>[0];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; proposalId: string }> }
) {
  try {
    const { id, proposalId } = await params;
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const proposal = await analysisRepository.findChangeProposalById(proposalId) as ChangeProposalRecord;
    if (!proposal || proposal.resumeId !== id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const action = String(body.action || '').trim();
    if (action === 'apply') {
      const result = await applyChangeProposal(proposalId, user.id);
      return NextResponse.json({ ...result, proposal: serializeProposal(result.proposal as ChangeProposalRecord) });
    }
    if (action === 'reject') {
      const result = await rejectChangeProposal(proposalId, user.id);
      return NextResponse.json({ proposal: serializeProposal(result.proposal as ChangeProposalRecord) });
    }
    if (action === 'undo') {
      const result = await undoChangeProposal(proposalId, user.id);
      return NextResponse.json({ ...result, proposal: serializeProposal(result.proposal as ChangeProposalRecord) });
    }
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message === 'Forbidden' ? 403 : message.includes('not found') || message.includes('Not found') ? 404 : 400;
    console.error('PATCH /api/resume/[id]/change-proposals/[proposalId] error:', error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; proposalId: string }> }
) {
  try {
    const { id, proposalId } = await params;
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const proposal = await analysisRepository.findChangeProposalById(proposalId) as ChangeProposalRecord;
    if (!proposal || proposal.resumeId !== id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await rejectChangeProposal(proposalId, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden' ? 403 : 400 });
  }
}
