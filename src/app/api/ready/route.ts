import { NextResponse } from 'next/server';
import { dbReady } from '@/lib/db';
import { logEvent } from '@/lib/observability/logger';
import { getRuntimeConfigurationIssues } from '@/lib/observability/runtime-readiness';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startedAt = performance.now();
  try {
    const configurationIssues = getRuntimeConfigurationIssues();
    if (configurationIssues.length > 0) {
      throw new Error(`Missing or insecure runtime configuration: ${configurationIssues.join(', ')}`);
    }

    await dbReady;
    return NextResponse.json({
      status: 'ready',
      databaseLatencyMs: Math.round(performance.now() - startedAt),
      version: process.env.NEXT_PUBLIC_APP_VERSION || process.env.APP_VERSION || null,
      commit: process.env.NEXT_PUBLIC_GIT_SHA || process.env.GIT_SHA || null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logEvent('error', 'readiness_check_failed', { error });
    return NextResponse.json(
      {
        status: 'not_ready',
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
