import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { requireAdmin } from '@/lib/auth/admin';
import { ensureCommercialCatalog } from '@/lib/commercial/bootstrap';
import { productRepository } from '@/lib/db/repositories/commercial.repository';

const createProductSchema = z.object({
  sku: z.string().min(1),
  type: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  priceCents: z.number().int().min(0).default(0),
  currency: z.string().default('CNY'),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    await ensureCommercialCatalog();
    const activeOnly = request.nextUrl.searchParams.get('activeOnly') !== '0';
    const products = await productRepository.list(activeOnly);
    return NextResponse.json({ products });
  } catch (error) {
    console.error('GET /api/admin/products error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    const parsed = createProductSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
    }

    const product = await productRepository.upsert(parsed.data);
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error('POST /api/admin/products error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: message === 'Internal server error' ? 500 : 400 });
  }
}
