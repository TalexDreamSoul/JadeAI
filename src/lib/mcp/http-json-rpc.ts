import { callResumeMcpTool, resumeMcpTools, type ResumeMcpToolContext } from './resume-tools';

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc?: '2.0';
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
};

const SERVER_INFO = {
  name: 'jadeai-resume-mcp',
  version: '0.1.0',
};

function response(id: JsonRpcId, result: unknown) {
  return { jsonrpc: '2.0', id, result };
}

function errorResponse(id: JsonRpcId, code: number, message: string, data?: unknown) {
  return {
    jsonrpc: '2.0',
    id,
    error: data === undefined ? { code, message } : { code, message, data },
  };
}

function isRequest(value: unknown): value is JsonRpcRequest {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export async function handleResumeMcpJsonRpc(input: unknown, context: ResumeMcpToolContext) {
  if (!isRequest(input)) {
    return errorResponse(null, -32600, 'Invalid request');
  }

  const id = input.id ?? null;
  const method = input.method || '';

  if (method === 'initialize') {
    return response(id, {
      protocolVersion: '2025-03-26',
      capabilities: {
        tools: {},
      },
      serverInfo: SERVER_INFO,
    });
  }

  if (method === 'ping') {
    return response(id, {});
  }

  if (method === 'tools/list') {
    return response(id, {
      tools: resumeMcpTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    });
  }

  if (method === 'tools/call') {
    const params = input.params || {};
    const name = typeof params.name === 'string' ? params.name : '';
    const args = params.arguments && typeof params.arguments === 'object' && !Array.isArray(params.arguments)
      ? params.arguments as Record<string, unknown>
      : {};

    if (!name) {
      return errorResponse(id, -32602, 'tools/call params.name is required');
    }

    return response(id, await callResumeMcpTool(name, args, context));
  }

  if (method.startsWith('notifications/')) {
    return null;
  }

  return errorResponse(id, -32601, `Method not found: ${method}`);
}
