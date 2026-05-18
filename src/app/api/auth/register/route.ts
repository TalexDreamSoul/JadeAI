import { NextRequest, NextResponse } from 'next/server';
import { registerPasswordUser } from '@/lib/auth/runtime-config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await registerPasswordUser({
      email: String(body.email || ''),
      password: String(body.password || ''),
      name: String(body.name || ''),
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.user, { status: result.status });
  } catch (error) {
    console.error('POST /api/auth/register error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
