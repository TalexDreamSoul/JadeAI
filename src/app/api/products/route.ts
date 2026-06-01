import { NextRequest, NextResponse } from 'next/server';
import { listProducts } from '@/lib/commercial/billing-service';
import { products as productsTable } from '@/lib/db/schema';

type Product = typeof productsTable.$inferSelect;

export async function GET(request: NextRequest) {
  try {
    const type = request.nextUrl.searchParams.get('type');
    const products = await listProducts();
    return NextResponse.json({
      products: type ? (products as Product[]).filter((product) => product.type === type) : products,
    });
  } catch (error) {
    console.error('GET /api/products error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
