import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    version: process.env.NEXT_PUBLIC_APP_VERSION || process.env.APP_VERSION || null,
    commit: process.env.NEXT_PUBLIC_GIT_SHA || process.env.GIT_SHA || null,
    timestamp: new Date().toISOString(),
  });
}
