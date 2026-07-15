'use client';

import { use } from 'react';
import { ResumeGraphCanvas } from '@/components/editor/resume-graph-canvas';

export default function ResumeGraphPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ResumeGraphCanvas resumeId={id} />;
}
