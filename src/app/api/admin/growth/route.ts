import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import {
  lotteryRepository,
  referralRepository,
} from '@/lib/db/repositories/commercial.repository';

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    const limit = Math.min(200, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 100)));
    const [referrals, campaigns, draws] = await Promise.all([
      referralRepository.listAll(limit),
      lotteryRepository.listCampaigns(false),
      lotteryRepository.listDraws(limit),
    ]);

    return NextResponse.json({
      referrals,
      lottery: {
        campaigns,
        draws,
      },
    });
  } catch (error) {
    console.error('GET /api/admin/growth error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
