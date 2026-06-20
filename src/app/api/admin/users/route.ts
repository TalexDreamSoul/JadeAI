import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { userRepository } from '@/lib/db/repositories/user.repository';
import { WALLET_CURRENCY_AI_CREDIT, WALLET_CURRENCY_POINT } from '@/lib/commercial/catalog';
import { membershipRepository, walletRepository } from '@/lib/db/repositories/commercial.repository';

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    const users = await userRepository.list();
    const result = await Promise.all(
      users.map(async (user: Awaited<ReturnType<typeof userRepository.list>>[number]) => {
        const [aiCreditAccount, pointAccount, aiCreditsConsumed, activeMembership] = await Promise.all([
          walletRepository.findAccount(user.id, WALLET_CURRENCY_AI_CREDIT),
          walletRepository.findAccount(user.id, WALLET_CURRENCY_POINT),
          walletRepository.sumDebits(user.id, WALLET_CURRENCY_AI_CREDIT),
          membershipRepository.getActiveMembership(user.id),
        ]);
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          authType: user.authType,
          role: user.role,
          aiCredits: user.aiCredits,
          aiCreditBalance: Number(aiCreditAccount?.balance ?? user.aiCredits ?? 0),
          aiCreditsConsumed,
          pointBalance: Number(pointAccount?.balance ?? 0),
          membership: activeMembership ? {
            status: activeMembership.membership.status,
            planKey: activeMembership.plan.key,
            planName: activeMembership.plan.name,
            tier: Number(activeMembership.plan.tier || 0),
            currentPeriodStart: activeMembership.membership.currentPeriodStart,
            currentPeriodEnd: activeMembership.membership.currentPeriodEnd,
            cancelAtPeriodEnd: Boolean(activeMembership.membership.cancelAtPeriodEnd),
          } : null,
          isVip: Number(activeMembership?.plan.tier || 0) > 0,
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
