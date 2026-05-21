import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { createUserMcpToken, getUserMcpAccess, revokeUserMcpToken } from '@/lib/mcp/user-mcp-access';

export const dynamic = 'force-dynamic';

async function requireUser(request: NextRequest) {
  const user = await resolveUser(getUserIdFromRequest(request));
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  return { user };
}

export async function GET(request: NextRequest) {
  try {
    const result = await requireUser(request);
    if (result.error) return result.error;
    return NextResponse.json({ access: await getUserMcpAccess(result.user!.id) });
  } catch (error) {
    console.error('GET /api/mcp/token error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await requireUser(request);
    if (result.error) return result.error;
    return NextResponse.json(await createUserMcpToken(result.user!.id), { status: 201 });
  } catch (error) {
    console.error('POST /api/mcp/token error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const result = await requireUser(request);
    if (result.error) return result.error;
    return NextResponse.json({ access: await revokeUserMcpToken(result.user!.id) });
  } catch (error) {
    console.error('DELETE /api/mcp/token error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
