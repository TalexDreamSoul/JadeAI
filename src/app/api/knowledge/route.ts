import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { knowledgeRepository } from '@/lib/db/repositories/knowledge.repository';

export async function GET(request: NextRequest) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [nodes, edges] = await Promise.all([
      knowledgeRepository.listNodes(user.id),
      knowledgeRepository.listEdges(user.id),
    ]);
    return NextResponse.json({ nodes, edges });
  } catch (error) {
    console.error('GET /api/knowledge error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const label = String(body.label || '').trim();
    if (!label) return NextResponse.json({ error: 'Knowledge label is required' }, { status: 400 });

    const node = await knowledgeRepository.createNode({
      userId: user.id,
      resumeId: body.resumeId ? String(body.resumeId) : null,
      type: String(body.type || 'note'),
      label,
      content: String(body.content || ''),
      metadata: body.metadata || {},
    });

    return NextResponse.json(node, { status: 201 });
  } catch (error) {
    console.error('POST /api/knowledge error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
