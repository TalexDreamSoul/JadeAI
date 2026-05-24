import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { getUserMcpAccess } from '@/lib/mcp/user-mcp-access';

export const dynamic = 'force-dynamic';

function firstHeaderValue(value: string | null) {
  return value?.split(',')[0]?.trim() || '';
}

function hostnameFromHostHeader(host: string) {
  const trimmed = host.trim();
  if (trimmed.startsWith('[')) {
    const end = trimmed.indexOf(']');
    return end > 0 ? trimmed.slice(1, end) : trimmed;
  }
  return trimmed.split(':')[0];
}

function isWildcardHost(host: string) {
  const hostname = hostnameFromHostHeader(host).toLowerCase();
  return hostname === '0.0.0.0' || hostname === '::';
}

function configuredBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  const clean = configured?.replace(/\/$/, '') || '';
  if (!clean) return '';

  try {
    const url = new URL(clean);
    return isWildcardHost(url.host) ? '' : clean;
  } catch {
    return clean;
  }
}

function baseUrl(request: NextRequest) {
  const configured = configuredBaseUrl();
  if (configured) return configured;

  // request.nextUrl.origin can become 0.0.0.0 when Next is bound to all
  // interfaces. Prefer the browser/proxy Host headers so copied MCP config uses
  // the current website origin.
  const host = firstHeaderValue(request.headers.get('x-forwarded-host'))
    || firstHeaderValue(request.headers.get('host'));
  if (host && !isWildcardHost(host)) {
    const proto = firstHeaderValue(request.headers.get('x-forwarded-proto'))
      || request.nextUrl.protocol.replace(':', '')
      || 'https';
    return `${proto}://${host}`.replace(/\/$/, '');
  }

  return request.nextUrl.origin.replace(/\/$/, '');
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
