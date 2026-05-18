import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { getGlobalAuthSettings } from '@/lib/auth/runtime-config';
import { userRepository } from '@/lib/db/repositories/user.repository';

async function requireAdmin(request: NextRequest) {
  const user = await resolveUser(getUserIdFromRequest(request));
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (user.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { user };
}

function sanitize(settings: Awaited<ReturnType<typeof getGlobalAuthSettings>>) {
  return {
    passwordLoginEnabled: settings.passwordLoginEnabled,
    passwordRegisterEnabled: settings.passwordRegisterEnabled,
    googleLoginEnabled: settings.googleLoginEnabled,
    googleClientId: settings.googleClientId || '',
    googleClientSecretSet: !!settings.googleClientSecret,
  };
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    const settings = await getGlobalAuthSettings();
    return NextResponse.json(sanitize(settings));
  } catch (error) {
    console.error('GET /api/admin/auth-settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    const current = await getGlobalAuthSettings();
    const body = await request.json().catch(() => ({}));
    const next = {
      ...(body.passwordLoginEnabled !== undefined ? { passwordLoginEnabled: Boolean(body.passwordLoginEnabled) } : {}),
      ...(body.passwordRegisterEnabled !== undefined ? { passwordRegisterEnabled: Boolean(body.passwordRegisterEnabled) } : {}),
      ...(body.googleLoginEnabled !== undefined ? { googleLoginEnabled: Boolean(body.googleLoginEnabled) } : {}),
      ...(body.googleClientId !== undefined ? { googleClientId: String(body.googleClientId).trim() } : {}),
      ...(body.googleClientSecret !== undefined
        ? { googleClientSecret: String(body.googleClientSecret).trim() || current.googleClientSecret || '' }
        : {}),
    };

    const updated = await userRepository.updateGlobalSettings(next);
    return NextResponse.json(
      sanitize({
        ...current,
        ...updated,
      })
    );
  } catch (error) {
    console.error('PUT /api/admin/auth-settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
