import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

type JsonRpcId = string | number | null;
type JsonRpcRequest = {
  jsonrpc?: '2.0';
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
};

type JsonRpcResponse = {
  jsonrpc: '2.0';
  id: JsonRpcId;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
};

const SERVER_INFO = {
  name: 'jadeai-resume-mcp',
  version: '0.1.0',
};

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseDotenvLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (!match) return null;

  let value = match[2].trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return { key: match[1], value };
}

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const entry = parseDotenvLine(line);
    if (entry && process.env[entry.key] === undefined) {
      process.env[entry.key] = entry.value;
    }
  }
}

function loadLocalEnv() {
  loadEnvFile(path.join(PROJECT_ROOT, '.env'));
  loadEnvFile(path.join(PROJECT_ROOT, '.env.local'));
}

function redirectConsoleToStderr() {
  const write = (level: string, args: unknown[]) => {
    const text = args.map((arg) => {
      if (typeof arg === 'string') return arg;
      if (arg instanceof Error) return arg.stack || arg.message;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    }).join(' ');
    process.stderr.write(`[${level}] ${text}\n`);
  };

  console.log = (...args: unknown[]) => write('log', args);
  console.info = (...args: unknown[]) => write('info', args);
  console.warn = (...args: unknown[]) => write('warn', args);
  console.error = (...args: unknown[]) => write('error', args);
}

function writeMessage(message: unknown) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function writeResponse(response: JsonRpcResponse) {
  writeMessage(response);
}

function toErrorResponse(id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: data === undefined ? { code, message } : { code, message, data },
  };
}

function isRequest(value: unknown): value is JsonRpcRequest {
  return !!value && typeof value === 'object';
}

async function main() {
  process.chdir(PROJECT_ROOT);
  loadLocalEnv();
  redirectConsoleToStderr();

  const { resumeMcpTools, callResumeMcpTool } = await import('../src/lib/mcp/resume-tools');

  async function handleRequest(request: JsonRpcRequest) {
    const id = request.id ?? null;
    const method = request.method || '';

    if (method === 'initialize') {
      writeResponse({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2025-03-26',
          capabilities: {
            tools: {},
          },
          serverInfo: SERVER_INFO,
        },
      });
      return;
    }

    if (method === 'ping') {
      writeResponse({ jsonrpc: '2.0', id, result: {} });
      return;
    }

    if (method === 'tools/list') {
      writeResponse({
        jsonrpc: '2.0',
        id,
        result: {
          tools: resumeMcpTools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
          })),
        },
      });
      return;
    }

    if (method === 'tools/call') {
      const params = request.params || {};
      const name = typeof params.name === 'string' ? params.name : '';
      const args = params.arguments && typeof params.arguments === 'object' && !Array.isArray(params.arguments)
        ? params.arguments as Record<string, unknown>
        : {};
      if (!name) {
        writeResponse(toErrorResponse(id, -32602, 'tools/call params.name is required'));
        return;
      }

      writeResponse({
        jsonrpc: '2.0',
        id,
        result: await callResumeMcpTool(name, args),
      });
      return;
    }

    if (method.startsWith('notifications/')) {
      return;
    }

    writeResponse(toErrorResponse(id, -32601, `Method not found: ${method}`));
  }

  process.stdin.setEncoding('utf8');

  let buffer = '';
  process.stdin.on('data', (chunk) => {
    buffer += chunk;
    while (true) {
      const index = buffer.indexOf('\n');
      if (index < 0) break;
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (!line) continue;

      void (async () => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(line);
        } catch (error) {
          writeResponse(toErrorResponse(null, -32700, 'Parse error', error instanceof Error ? error.message : error));
          return;
        }

        if (!isRequest(parsed)) {
          writeResponse(toErrorResponse(null, -32600, 'Invalid request'));
          return;
        }

        await handleRequest(parsed).catch((error) => {
          const id = parsed.id ?? null;
          writeResponse(toErrorResponse(id, -32603, error instanceof Error ? error.message : 'Internal error'));
        });
      })();
    }
  });
}

main().catch((error) => {
  process.stderr.write(`[jadeai-resume-mcp] ${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exit(1);
});
