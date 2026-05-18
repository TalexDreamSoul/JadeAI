import { NextResponse } from 'next/server';
import { getGlobalAuthSettings, getPublicAuthProviders } from '@/lib/auth/runtime-config';

export async function GET() {
  try {
    const [providers, settings] = await Promise.all([getPublicAuthProviders(), getGlobalAuthSettings()]);
    return NextResponse.json({ providers, passwordRegisterEnabled: settings.passwordRegisterEnabled });
  } catch (error) {
    console.error('GET /api/auth/providers-config error:', error);
    return NextResponse.json(
      {
        providers: [
          { id: 'password', enabled: true },
          { id: 'google', enabled: false },
        ],
      },
      { status: 200 }
    );
  }
}
