import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { knowledgeRepository } from '@/lib/db/repositories/knowledge.repository';

export async function POST(request: NextRequest) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const fromNodeId = String(body.fromNodeId || '');
    const toNodeId = String(body.toNodeId || '');
    if (!fromNodeId || !toNodeId) {
      return NextResponse.json({ error: 'fromNodeId and toNodeId are required' }, { status: 400 });
    }

    const edge = await knowledgeRepository.createEdge({
      userId: user.id,
      fromNodeId,
      toNodeId,
      relation: String(body.relation || 'related'),
      metadata: body.metadata || {},
    });
    return NextResponse.json(edge, { status: 201 });
  } catch (error) {
    console.error('POST /api/knowledge/edges error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
