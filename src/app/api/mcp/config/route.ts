import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { getUserMcpAccess } from '@/lib/mcp/user-mcp-access';

export const dynamic = 'force-dynamic';

function baseUrl(request: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
    || request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  try {
    const user = await resolveUser(getUserIdFromRequest(request));
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const origin = baseUrl(request);
    const endpoint = `${origin}/api/mcp/resume`;

    return NextResponse.json({
      access: await getUserMcpAccess(user.id),
      endpoint,
      transport: 'http-json-rpc',
      tools: [
        'list_resumes',
        'get_resume',
        'list_jd_analyses',
        'search_knowledge',
        'get_resume_context_pack',
        'create_resume_version',
        'update_resume_section',
        'apply_suggestion',
        'create_role_resume',
      ],
      clients: {
        codex: {
          command: 'Use an HTTP MCP server entry with the endpoint and Authorization Bearer token shown after creation.',
          endpoint,
          headers: { Authorization: 'Bearer <your-token>' },
        },
        claude: {
          url: endpoint,
          headers: { Authorization: 'Bearer <your-token>' },
        },
        cursor: {
          url: endpoint,
          headers: { Authorization: 'Bearer <your-token>' },
        },
      },
    });
  } catch (error) {
    console.error('GET /api/mcp/config error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
