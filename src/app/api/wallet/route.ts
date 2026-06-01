import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { ensureUserCommercialDefaults } from '@/lib/commercial/bootstrap';
import { walletRepository } from '@/lib/db/repositories/commercial.repository';

export async function GET(request: NextRequest) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureUserCommercialDefaults(user.id, Number(user.aiCredits || 0));
    const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 50)));
    const [accounts, transactions] = await Promise.all([
      walletRepository.listAccounts(user.id),
      walletRepository.listTransactions(user.id, limit),
    ]);
    return NextResponse.json({ accounts, transactions });
  } catch (error) {
    console.error('GET /api/wallet error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
