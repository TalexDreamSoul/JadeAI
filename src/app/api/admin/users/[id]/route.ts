import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { userRepository } from '@/lib/db/repositories/user.repository';
import { adminAuditRepository, membershipRepository, walletRepository } from '@/lib/db/repositories/commercial.repository';
import { WALLET_CURRENCY_AI_CREDIT, WALLET_CURRENCY_POINT } from '@/lib/commercial/catalog';

function clientIp(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || null;
}

function pickChangedBeforeAfter(input: {
  beforeRole: string;
  afterRole: string;
  beforeBalance: number;
  afterBalance: number;
}) {
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  if (input.beforeRole !== input.afterRole) {
    before.role = input.beforeRole;
    after.role = input.afterRole;
  }
  if (input.beforeBalance !== input.afterBalance) {
    before.aiCreditBalance = input.beforeBalance;
    after.aiCreditBalance = input.afterBalance;
  }
  return { before, after };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    if (body.confirmed !== true) {
      return NextResponse.json({ error: 'Confirmation required' }, { status: 400 });
    }

    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!reason) {
      return NextResponse.json({ error: 'Change reason required' }, { status: 400 });
    }

    const existing = await userRepository.findById(id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const beforeAccount = await walletRepository.findAccount(id, WALLET_CURRENCY_AI_CREDIT);
    const beforeBalance = Number(beforeAccount?.balance ?? existing.aiCredits ?? 0);
    const patch: Partial<{ role: 'user' | 'admin'; aiCredits: number }> = {};

    if (body.role === 'user' || body.role === 'admin') {
      patch.role = body.role;
    }

    const updated = await userRepository.update(id, patch);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const aiCreditBalance = body.aiCreditBalance ?? body.aiCredits;
    let aiCreditAccount = await walletRepository.findAccount(updated.id, WALLET_CURRENCY_AI_CREDIT);
    if (aiCreditBalance !== undefined) {
      const targetBalance = Math.max(0, Math.floor(Number(aiCreditBalance) || 0));
      aiCreditAccount = await userRepository.setAICredits(updated.id, targetBalance, 'admin_adjustment', {
        adminUserId: admin.user.id,
        targetBalance,
        reason,
      });
    }

    const afterBalance = Number(aiCreditAccount?.balance ?? updated.aiCredits ?? 0);
    const { before, after } = pickChangedBeforeAfter({
      beforeRole: existing.role,
      afterRole: updated.role,
      beforeBalance,
      afterBalance,
    });

    if (Object.keys(after).length > 0) {
      await adminAuditRepository.record({
        adminUserId: admin.user.id,
        targetUserId: updated.id,
        action: 'user.update',
        targetType: 'user',
        before,
        after,
        reason,
        ipAddress: clientIp(request),
        userAgent: request.headers.get('user-agent'),
      });
    }

    const [pointAccount, aiCreditsConsumed, activeMembership] = await Promise.all([
      walletRepository.findAccount(updated.id, WALLET_CURRENCY_POINT),
      walletRepository.sumDebits(updated.id, WALLET_CURRENCY_AI_CREDIT),
      membershipRepository.getActiveMembership(updated.id),
    ]);

    return NextResponse.json({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      avatarUrl: updated.avatarUrl,
      authType: updated.authType,
      role: updated.role,
      aiCredits: Number(aiCreditAccount?.balance ?? updated.aiCredits ?? 0),
      aiCreditBalance: Number(aiCreditAccount?.balance ?? updated.aiCredits ?? 0),
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
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    console.error('PATCH /api/admin/users/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
