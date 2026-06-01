import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { getGrowthDashboard } from '@/lib/commercial/growth-service';

export async function GET(request: NextRequest) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const growth = await getGrowthDashboard(user.id);
    return NextResponse.json(growth);
  } catch (error) {
    console.error('GET /api/growth error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
