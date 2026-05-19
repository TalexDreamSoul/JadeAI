import { NextResponse } from 'next/server';
import { JOB_TEMPLATES } from '@/lib/career/job-templates';
import { jobTemplateRepository, toJobTemplate } from '@/lib/db/repositories/job-template.repository';

export async function GET() {
  const customTemplates = await jobTemplateRepository.listEnabled().catch(() => []);
  return NextResponse.json([
    ...JOB_TEMPLATES,
    ...customTemplates.map(toJobTemplate),
  ]);
}
