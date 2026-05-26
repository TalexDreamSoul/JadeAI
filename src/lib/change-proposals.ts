import type { ApplicableSuggestion } from '@/lib/ai/jd-analysis-schema';
import { buildSuggestionUpdate } from '@/lib/career/suggestion-application';
import { analysisRepository } from '@/lib/db/repositories/analysis.repository';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import type { Resume, ResumeSection } from '@/types/resume';

type ProposalLike = {
  id: string;
  resumeId: string;
  userId?: string | null;
  source?: string | null;
  sourceId?: string | null;
  shareId?: string | null;
  commentId?: string | null;
  sectionId?: string | null;
  sectionType: string;
  targetField: string;
  current: string;
  suggested: string;
  reason: string;
  evidenceRequired?: boolean | number | null;
  status: string;
  metadata?: unknown;
  undoContent?: unknown;
};

export function proposalToSuggestion(proposal: ProposalLike): ApplicableSuggestion {
  return {
    sectionType: proposal.sectionType,
    targetField: proposal.targetField || 'text',
    current: proposal.current || '',
    suggested: proposal.suggested || '',
    reason: proposal.reason || '',
    evidenceRequired: !!proposal.evidenceRequired,
  };
}

export function serializeProposal(proposal: ProposalLike | null) {
  if (!proposal) return null;
  return {
    id: proposal.id,
    resumeId: proposal.resumeId,
    source: proposal.source,
    sourceId: proposal.sourceId,
    shareId: proposal.shareId,
    commentId: proposal.commentId,
    sectionId: proposal.sectionId,
    sectionType: proposal.sectionType,
    targetField: proposal.targetField,
    current: proposal.current,
    suggested: proposal.suggested,
    reason: proposal.reason,
    evidenceRequired: !!proposal.evidenceRequired,
    status: proposal.status,
    metadata: proposal.metadata || {},
  };
}

function updateForProposal(resume: Resume, proposal: ProposalLike) {
  const suggestion = proposalToSuggestion(proposal);
  if (proposal.sectionId) {
    const section = (resume.sections as ResumeSection[]).find((item) => item.id === proposal.sectionId);
    if (!section) throw new Error('Section not found');
  }
  return buildSuggestionUpdate(resume, suggestion);
}

export async function applyChangeProposal(proposalId: string, userId: string) {
  const proposal = await analysisRepository.findChangeProposalById(proposalId) as ProposalLike | null;
  if (!proposal) throw new Error('Proposal not found');
  if (proposal.status === 'applied') throw new Error('Proposal already applied');
  if (proposal.status !== 'pending') throw new Error('Proposal is not pending');

  const resume = await resumeRepository.findById(proposal.resumeId) as Resume | null;
  if (!resume) throw new Error('Resume not found');
  if (resume.userId !== userId) throw new Error('Forbidden');

  const update = updateForProposal(resume, proposal);
  const beforeVersion = await resumeRepository.createVersion(proposal.resumeId, `proposal-before-${Date.now()}`, resume, proposal.source || 'ai').catch(() => null);
  await resumeRepository.updateSection(update.section.id, { content: update.nextContent });
  const updated = await resumeRepository.findById(proposal.resumeId);
  const afterVersion = updated
    ? await resumeRepository.createVersion(proposal.resumeId, `proposal-after-${Date.now()}`, updated, proposal.source || 'ai').catch(() => null)
    : null;

  const nextProposal = await analysisRepository.updateChangeProposal(proposal.id, {
    status: 'applied',
    beforeVersionId: beforeVersion?.id || null,
    appliedVersionId: afterVersion?.id || null,
    undoContent: update.previousContent,
  });

  await resumeRepository.createEvent({
    resumeId: proposal.resumeId,
    userId,
    type: 'change_proposal.applied',
    title: 'Change proposal applied',
    description: proposal.reason || proposal.suggested,
    metadata: { proposalId: proposal.id, beforeVersionId: beforeVersion?.id || null, afterVersionId: afterVersion?.id || null },
  }).catch(() => null);

  return { proposal: nextProposal, resume: updated, sectionId: update.section.id, beforeVersion, afterVersion };
}

export async function rejectChangeProposal(proposalId: string, userId: string) {
  const proposal = await analysisRepository.findChangeProposalById(proposalId) as ProposalLike | null;
  if (!proposal) throw new Error('Proposal not found');
  const resume = await resumeRepository.findById(proposal.resumeId);
  if (!resume) throw new Error('Resume not found');
  if (resume.userId !== userId) throw new Error('Forbidden');
  const updated = await analysisRepository.updateChangeProposal(proposal.id, { status: 'rejected' });
  return { proposal: updated };
}

export async function undoChangeProposal(proposalId: string, userId: string) {
  const proposal = await analysisRepository.findChangeProposalById(proposalId) as ProposalLike | null;
  if (!proposal) throw new Error('Proposal not found');
  if (proposal.status !== 'applied') throw new Error('Proposal is not applied');
  const resume = await resumeRepository.findById(proposal.resumeId) as Resume | null;
  if (!resume) throw new Error('Resume not found');
  if (resume.userId !== userId) throw new Error('Forbidden');
  if (!proposal.sectionId) throw new Error('Proposal has no section');

  const section = (resume.sections as ResumeSection[]).find((item) => item.id === proposal.sectionId || item.type === proposal.sectionType);
  if (!section) throw new Error('Section not found');
  await resumeRepository.updateSection(section.id, { content: proposal.undoContent });
  const updatedResume = await resumeRepository.findById(proposal.resumeId);
  const afterVersion = updatedResume
    ? await resumeRepository.createVersion(proposal.resumeId, `proposal-undo-${Date.now()}`, updatedResume, proposal.source || 'ai').catch(() => null)
    : null;
  const updatedProposal = await analysisRepository.updateChangeProposal(proposal.id, {
    status: 'pending',
    appliedVersionId: null,
    undoContent: null,
    metadata: { ...(proposal.metadata && typeof proposal.metadata === 'object' ? proposal.metadata as Record<string, unknown> : {}), lastUndoVersionId: afterVersion?.id || null },
  });
  await resumeRepository.createEvent({
    resumeId: proposal.resumeId,
    userId,
    type: 'change_proposal.undone',
    title: 'Change proposal undone',
    description: proposal.reason || '',
    metadata: { proposalId: proposal.id, undoVersionId: afterVersion?.id || null },
  }).catch(() => null);
  return { proposal: updatedProposal, resume: updatedResume, sectionId: section.id, afterVersion };
}
