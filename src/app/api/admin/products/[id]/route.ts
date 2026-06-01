import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { requireAdmin } from '@/lib/auth/admin';
import { productRepository } from '@/lib/db/repositories/commercial.repository';

const updateProductSchema = z.object({
  sku: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  priceCents: z.number().int().min(0).optional(),
  currency: z.string().optional(),
  resourceType: z.string().nullable().optional(),
  resourceId: z.string().nullable().optional(),
  active: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    const { id } = await params;
    const parsed = updateProductSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
    }

    const product = await productRepository.update(id, parsed.data);
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    return NextResponse.json(product);
  } catch (error) {
    console.error('PATCH /api/admin/products/[id] error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: message === 'Internal server error' ? 500 : 400 });
  }
}
