import { NextResponse } from 'next/server';
import { getGlobalAuthSettings, getPublicAuthProviders } from '@/lib/auth/runtime-config';

export async function GET() {
  try {
    const [providers, settings] = await Promise.all([getPublicAuthProviders(), getGlobalAuthSettings()]);
    return NextResponse.json({
      providers,
      authMode: settings.authMode,
      passwordRegisterEnabled: settings.passwordRegisterEnabled,
      adminPasswordEnabled: settings.adminPasswordEnabled,
      loginFooterText: settings.loginFooterText,
      loginFooterLinkText: settings.loginFooterLinkText,
      loginFooterLinkUrl: settings.loginFooterLinkUrl,
    });
  } catch (error) {
    console.error('GET /api/auth/providers-config error:', error);
    return NextResponse.json(
      {
        providers: [
          { id: 'password', enabled: true },
        ],
        authMode: 'local',
        passwordRegisterEnabled: true,
        adminPasswordEnabled: false,
      },
      { status: 200 }
    );
  }
}
