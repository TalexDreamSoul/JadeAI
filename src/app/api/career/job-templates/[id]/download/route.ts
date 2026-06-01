import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import {
  ensureJobTemplateAccessPayload,
  grantMonthlyFreeDownload,
  grantPlanDownloadEntitlement,
} from '@/lib/commercial/content-entitlement-service';
import { jobTemplateRepository, toJobTemplate } from '@/lib/db/repositories/job-template.repository';

function safeFilename(value: string) {
  return value.replace(/[^\w\u4e00-\u9fa5.-]+/g, '-').replace(/-+/g, '-').slice(0, 80) || 'job-template';
}

function renderMarkdown(template: ReturnType<typeof toJobTemplate>) {
  return [
    `# ${template.title}`,
    '',
    `- 行业：${template.industry}`,
    `- 级别：${template.level}`,
    `- 标识：${template.roleKey}`,
    '',
    '## 职位描述',
    '',
    template.jd || '-',
    '',
    '## 关键词',
    '',
    ...(template.keywords.length ? template.keywords.map((item) => `- ${item}`) : ['-']),
    '',
    '## 推荐简历模块',
    '',
    ...(template.recommendedSections.length ? template.recommendedSections.map((item) => `- ${item}`) : ['-']),
    '',
    '## 面试问题',
    '',
    ...(template.interviewQuestions.length ? template.interviewQuestions.map((item, index) => `${index + 1}. ${item}`) : ['-']),
    '',
  ].join('\n');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const template = await jobTemplateRepository.findById(id);
    if (!template || (!template.enabled && template.ownerUserId !== user.id)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { product, access } = await ensureJobTemplateAccessPayload({
      userId: user.id,
      jobTemplateId: template.id,
      name: template.title,
      description: template.jd.slice(0, 160),
      owner: template.ownerUserId === user.id,
      admin: user.role === 'admin',
      legacyAiCredits: Number(user.aiCredits || 0),
    });

    if (access.planEntitled && !access.directEntitled && !access.owned) {
      await grantPlanDownloadEntitlement({
        userId: user.id,
        resourceType: 'job_template',
        resourceId: template.id,
        product,
        name: template.title,
        legacyAiCredits: Number(user.aiCredits || 0),
      });
    }

    if (!access.entitled) {
      const freeGrant = await grantMonthlyFreeDownload({
        userId: user.id,
        resourceType: 'job_template',
        resourceId: template.id,
        product,
        name: template.title,
        legacyAiCredits: Number(user.aiCredits || 0),
      });
      if (!freeGrant.granted) {
        return NextResponse.json({
          error: 'Payment required',
          code: 'content_payment_required',
          product,
          freeDownloads: freeGrant.state.freeDownloads,
        }, { status: 402 });
      }
    }

    const data = toJobTemplate(template);
    const format = request.nextUrl.searchParams.get('format') === 'json' ? 'json' : 'md';
    const filename = `${safeFilename(data.title)}.${format}`;
    if (format === 'json') {
      return new NextResponse(JSON.stringify({ id: template.id, ...data }, null, 2), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        },
      });
    }

    return new NextResponse(renderMarkdown(data), {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (error) {
    console.error('GET /api/career/job-templates/[id]/download error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
