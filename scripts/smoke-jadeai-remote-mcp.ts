import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const sqliteDir = path.join(tmpdir(), `jadeai-remote-mcp-smoke-${process.pid}-${Date.now()}`);
const sqlitePath = path.join(sqliteDir, 'touchresume.db');

process.env.AUTH_ENABLED = 'false';
process.env.SQLITE_PATH = sqlitePath;

mkdirSync(sqliteDir, { recursive: true });

async function main() {
  const { dbReady } = await import('../src/lib/db');
  const { userRepository } = await import('../src/lib/db/repositories/user.repository');
  const { createUserMcpToken, resolveUserByMcpToken } = await import('../src/lib/mcp/user-mcp-access');
  const { handleResumeMcpJsonRpc } = await import('../src/lib/mcp/http-json-rpc');

  await dbReady;

  const user = await userRepository.upsertByFingerprint('remote-mcp-smoke');
  if (!user) throw new Error('Smoke user was not created');

  const { token, access } = await createUserMcpToken(user.id);
  if (!access.enabled || !token.startsWith('jai_mcp_')) {
    throw new Error('MCP token was not created');
  }

  const resolved = await resolveUserByMcpToken(token);
  if (!resolved || resolved.id !== user.id) {
    throw new Error('MCP token did not resolve to the expected user');
  }

  const init = await handleResumeMcpJsonRpc({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {},
  }, { user });

  const list = await handleResumeMcpJsonRpc({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {},
  }, { user });

  const call = await handleResumeMcpJsonRpc({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'list_resumes',
      arguments: {},
    },
  }, { user });

  console.log(JSON.stringify({
    ok: true,
    sqlitePath,
    tokenPreview: access.tokenPreview,
    initServer: (init as { result?: { serverInfo?: { name?: string } } }).result?.serverInfo?.name,
    toolCount: ((list as { result?: { tools?: unknown[] } }).result?.tools || []).length,
    resumeCount: ((call as { result?: { structuredContent?: { resumes?: unknown[] } } }).result?.structuredContent?.resumes || []).length,
  }, null, 2));
}

main()
  .finally(() => {
    rmSync(sqliteDir, { recursive: true, force: true });
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
