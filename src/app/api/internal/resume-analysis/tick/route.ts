import { NextRequest, NextResponse } from 'next/server';
import { ResumeAnalysisWorker } from '@/lib/resume-analysis/worker';

export const maxDuration = 300;

function isAuthorized(request: NextRequest) {
  const token = process.env.RESUME_ANALYSIS_WORKER_TOKEN;
  if (!token) return true;
  return request.headers.get('x-worker-token') === token;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const worker = new ResumeAnalysisWorker({
      workerId: request.headers.get('x-worker-id') || undefined,
      idleExit: true,
    });
    const jobId = await worker.runOnce();
    return NextResponse.json({ processed: Boolean(jobId), jobId });
  } catch (error) {
    console.error('POST /api/internal/resume-analysis/tick error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
