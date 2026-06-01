import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { userRepository } from '@/lib/db/repositories/user.repository';
import { walletRepository } from '@/lib/db/repositories/commercial.repository';
import { WALLET_CURRENCY_AI_CREDIT } from '@/lib/commercial/catalog';

async function requireAdmin(request: NextRequest) {
  const user = await resolveUser(getUserIdFromRequest(request));
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (user.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { user };
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    const users = await userRepository.list();
    const result = await Promise.all(
      users.map(async (user: Awaited<ReturnType<typeof userRepository.list>>[number]) => {
        const aiCreditAccount = await walletRepository.findAccount(user.id, WALLET_CURRENCY_AI_CREDIT);
        return {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        authType: user.authType,
        role: user.role,
        aiCredits: user.aiCredits,
        aiCreditBalance: Number(aiCreditAccount?.balance ?? user.aiCredits ?? 0),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        };
      })
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/admin/users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
