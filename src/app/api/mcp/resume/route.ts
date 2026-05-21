import { NextRequest, NextResponse } from 'next/server';
import { handleResumeMcpJsonRpc } from '@/lib/mcp/http-json-rpc';
import { resolveUserByMcpToken } from '@/lib/mcp/user-mcp-access';

export const dynamic = 'force-dynamic';

function bearerToken(request: NextRequest) {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

export async function GET() {
  return NextResponse.json({
    name: 'jadeai-resume-mcp',
    transport: 'http-json-rpc',
    auth: 'Bearer token',
    endpoint: '/api/mcp/resume',
  });
}

export async function POST(request: NextRequest) {
  try {
    const token = bearerToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Missing Bearer token' }, { status: 401 });
    }

    const user = await resolveUserByMcpToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid MCP token' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const result = await handleResumeMcpJsonRpc(body, { user });
    if (result === null) {
      return new Response(null, { status: 202 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('POST /api/mcp/resume error:', error);
    return NextResponse.json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32603, message: 'Internal server error' },
    }, { status: 500 });
  }
}
