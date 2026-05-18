import { NextRequest, NextResponse } from 'next/server';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import { shareRepository } from '@/lib/db/repositories/share.repository';
import { resolveUser, getUserIdFromRequest } from '@/lib/auth/helpers';
import { generateShareToken, getShareUrl, hashPassword } from '@/lib/utils/share';

type ResumeShareRecord = {
  id: string;
  token: string;
  password?: string | null;
  [key: string]: unknown;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const fingerprint = getUserIdFromRequest(request);
    const user = await resolveUser(fingerprint);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resume = await resumeRepository.findById(id);
    if (!resume) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (resume.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const shares = await shareRepository.findByResumeId(id);
    const sharesWithUrl = (shares as ResumeShareRecord[]).map((s) => ({
      ...s,
      reviewEnabled: !!s.reviewEnabled,
      downloadEnabled: !!s.downloadEnabled,
      viewRequiresLogin: !!s.viewRequiresLogin,
      anonymousShare: !!s.anonymousShare,
      hideSensitiveInfo: !!s.hideSensitiveInfo,
      isActive: !!s.isActive,
      shareUrl: getShareUrl(s.token, request),
      hasPassword: !!s.password,
      password: undefined,
    }));

    return NextResponse.json(sharesWithUrl);
  } catch (error) {
    console.error('GET /api/resume/[id]/shares error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const fingerprint = getUserIdFromRequest(request);
    const user = await resolveUser(fingerprint);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resume = await resumeRepository.findById(id);
    if (!resume) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (resume.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { label, password, reviewEnabled, downloadEnabled, viewRequiresLogin, anonymousShare, hideSensitiveInfo } = body as {
      label?: string;
      password?: string;
      reviewEnabled?: boolean;
      downloadEnabled?: boolean;
      viewRequiresLogin?: boolean;
      anonymousShare?: boolean;
      hideSensitiveInfo?: boolean;
    };

    const token = generateShareToken();
    const hashedPassword = password ? await hashPassword(password) : null;
    const existingShares = await shareRepository.findByResumeId(id);
    const normalizedLabel = String(label || '').trim() || `分享 ${existingShares.length + 1}`;

    const share = await shareRepository.create({
      resumeId: id,
      token,
      label: normalizedLabel,
      password: hashedPassword,
      reviewEnabled: reviewEnabled ?? false,
      downloadEnabled: downloadEnabled ?? true,
      viewRequiresLogin: viewRequiresLogin ?? false,
      anonymousShare: anonymousShare ?? false,
      hideSensitiveInfo: hideSensitiveInfo ?? false,
    });

    return NextResponse.json({
      ...share,
      reviewEnabled: !!share?.reviewEnabled,
      downloadEnabled: !!share?.downloadEnabled,
      viewRequiresLogin: !!share?.viewRequiresLogin,
      anonymousShare: !!share?.anonymousShare,
      hideSensitiveInfo: !!share?.hideSensitiveInfo,
      isActive: !!share?.isActive,
      shareUrl: getShareUrl(token, request),
      hasPassword: !!hashedPassword,
      password: undefined,
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/resume/[id]/shares error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
