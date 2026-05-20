import { NextResponse } from 'next/server';
import { dbReady } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await dbReady;
    return NextResponse.json({
      status: 'ready',
      version: process.env.NEXT_PUBLIC_APP_VERSION || process.env.APP_VERSION || null,
      commit: process.env.NEXT_PUBLIC_GIT_SHA || process.env.GIT_SHA || null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'not_ready',
        error: error instanceof Error ? error.message : 'Database initialization failed',
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
