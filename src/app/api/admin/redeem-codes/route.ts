import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { requireAdmin } from '@/lib/auth/admin';
import { ensureCommercialCatalog } from '@/lib/commercial/bootstrap';
import { redeemCodeRepository } from '@/lib/db/repositories/commercial.repository';

const benefitItemSchema = z.union([
  z.object({
    type: z.literal('membership'),
    planKey: z.string().min(1),
    durationDays: z.number().int().positive().default(7),
  }),
  z.object({
    type: z.literal('wallet'),
    currency: z.string().min(1),
    amount: z.number().int().positive(),
    description: z.string().optional(),
  }),
  z.object({
    type: z.literal('entitlement'),
    key: z.string().min(1),
    value: z.unknown().default(true),
    expiresInDays: z.number().int().positive().optional(),
  }),
]);

const createRedeemCodeSchema = z.object({
  code: z.string().min(3),
  type: z.string().default('benefit'),
  status: z.string().default('active'),
  maxClaims: z.number().int().positive().default(1),
  benefit: z.object({
    items: z.array(benefitItemSchema).min(1),
  }),
  startsAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    const limit = Math.min(200, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 100)));
    const redeemCodes = await redeemCodeRepository.list(limit);
    return NextResponse.json({ redeemCodes });
  } catch (error) {
    console.error('GET /api/admin/redeem-codes error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    await ensureCommercialCatalog();
    const parsed = createRedeemCodeSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
    }

    const redeemCode = await redeemCodeRepository.upsert({
      code: parsed.data.code,
      type: parsed.data.type,
      status: parsed.data.status,
      maxClaims: parsed.data.maxClaims,
      benefit: parsed.data.benefit,
      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    });
    return NextResponse.json(redeemCode, { status: 201 });
  } catch (error) {
    console.error('POST /api/admin/redeem-codes error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: message === 'Internal server error' ? 500 : 400 });
  }
}
