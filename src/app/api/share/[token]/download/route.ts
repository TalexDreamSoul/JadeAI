import { NextRequest, NextResponse } from 'next/server';
import { shareRepository } from '@/lib/db/repositories/share.repository';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import { generateHtml } from '@/app/api/resume/[id]/export/builders';
import { generatePlainText } from '@/app/api/resume/[id]/export/plain-text';
import { generateDocxBuffer } from '@/app/api/resume/[id]/export/docx';
import { generatePdf } from '@/lib/pdf/generate-pdf';
import { hashPassword } from '@/lib/utils/share';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { sanitizeResumeForShare } from '@/lib/share/review';
import {
  assertCanExportResume,
  commercialFeatureLockedResponse,
  CommercialFeatureLockedError,
} from '@/lib/commercial/feature-gate-service';

export const maxDuration = 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const password = request.nextUrl.searchParams.get('password');
    const format = request.nextUrl.searchParams.get('format') || 'pdf';

    const share = await shareRepository.findByToken(token);
    if (!share || !share.isActive) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!share.downloadEnabled) return NextResponse.json({ error: 'Download is disabled' }, { status: 403 });
    let viewer = null;
    if (share.viewRequiresLogin) {
      viewer = await resolveUser(getUserIdFromRequest(request));
      if (!viewer) return NextResponse.json({ error: 'Login required', loginRequired: true }, { status: 401 });
    }

    if (share.password) {
      if (!password) return NextResponse.json({ error: 'Password required', passwordRequired: true }, { status: 401 });
      if (await hashPassword(password) !== share.password) {
        return NextResponse.json({ error: 'Invalid password', passwordRequired: true }, { status: 401 });
      }
    }

    const rawResume = await resumeRepository.findById(share.resumeId);
    if (!rawResume) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await assertCanExportResume(rawResume.userId, format);
    const resume = sanitizeResumeForShare(rawResume, !!share.hideSensitiveInfo);

    const filename = `${resume.title || 'resume'}-${token}`;
    if (format === 'json') return NextResponse.json(resume);
    if (format === 'html') {
      return new NextResponse(await generateHtml(resume), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}.html"`,
        },
      });
    }
    if (format === 'txt') {
      return new NextResponse(generatePlainText(resume), {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}.txt"`,
        },
      });
    }
    if (format === 'docx') {
      const docxBuffer = await generateDocxBuffer(resume);
      return new NextResponse(new Uint8Array(docxBuffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}.docx"`,
        },
      });
    }

    const pdfBuffer = await generatePdf(await generateHtml(resume, true), {
      fitOnePage: request.nextUrl.searchParams.get('fitOnePage') === 'true',
    });
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}.pdf"`,
      },
    });
  } catch (error) {
    if (error instanceof CommercialFeatureLockedError) {
      return commercialFeatureLockedResponse(error);
    }
    console.error('GET /api/share/[token]/download error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
