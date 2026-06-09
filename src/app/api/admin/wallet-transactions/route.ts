import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { WALLET_CURRENCY_AI_CREDIT } from '@/lib/commercial/catalog';
import { walletRepository } from '@/lib/db/repositories/commercial.repository';

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    const limit = Math.min(200, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 100)));
    const currency = request.nextUrl.searchParams.get('currency') || WALLET_CURRENCY_AI_CREDIT;
    const directionParam = request.nextUrl.searchParams.get('direction') || undefined;
    const direction = directionParam && directionParam !== 'all' ? directionParam : undefined;
    const transactions = await walletRepository.listAllTransactionsDetailed(limit, currency, direction);
    return NextResponse.json({ transactions });
  } catch (error) {
    console.error('GET /api/admin/wallet-transactions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
