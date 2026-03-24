import { Hono } from 'hono';
import type { GatewayEnv, McpRequest, McpResponse } from '../types.js';

/**
 * MCP protocol endpoint.
 *
 * Handles Streamable HTTP MCP connections at POST /mcp.
 * This is the primary interface for LLM clients that speak the
 * Model Context Protocol natively.
 *
 * The gateway validates the incoming JSON-RPC envelope, then proxies
 * the request to the workspace's MCP server. In this initial implementation,
 * the proxy target is stubbed -- it will be replaced with actual HTTP
 * forwarding to the per-workspace MCP server container.
 */
const mcp = new Hono<GatewayEnv>();

/**
 * MCP server URL resolver.
 * In production, this would look up the workspace container's internal address.
 */
function getMcpServerUrl(workspaceId: string): string {
  return `http://workspace-${workspaceId}.internal:3000/mcp`;
}

/**
 * Validate a JSON-RPC 2.0 request envelope.
 */
function validateJsonRpc(body: unknown): body is McpRequest {
  if (!body || typeof body !== 'object') return false;
  const obj = body as Record<string, unknown>;
  return (
    obj.jsonrpc === '2.0' &&
    (typeof obj.id === 'string' || typeof obj.id === 'number') &&
    typeof obj.method === 'string'
  );
}

/**
 * Build a JSON-RPC error response.
 */
function jsonRpcError(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown
): McpResponse {
  return {
    jsonrpc: '2.0',
    id: id ?? 0,
    error: { code, message, data },
  };
}

// ---------------------------------------------------------------------------
// POST /mcp
// Streamable HTTP MCP endpoint
// ---------------------------------------------------------------------------

/**
 * POST /mcp
 *
 * Accepts a JSON-RPC 2.0 request conforming to the MCP specification.
 * The request is validated, then forwarded to the workspace MCP server.
 *
 * Supported MCP methods (proxied to the workspace server):
 * - initialize
 * - tools/list
 * - tools/call
 * - resources/list
 * - resources/read
 * - prompts/list
 * - prompts/get
 * - completion/complete
 */
mcp.post('/mcp', async (c) => {
  const token = c.get('token');

  // Parse the JSON-RPC body
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      jsonRpcError(null, -32700, 'Parse error: invalid JSON.'),
      400
    );
  }

  // Handle batch requests (array of JSON-RPC calls)
  if (Array.isArray(body)) {
    const results: McpResponse[] = [];

    for (const item of body) {
      if (!validateJsonRpc(item)) {
        results.push(
          jsonRpcError(
            (item as Record<string, unknown>)?.id as string | number ?? null,
            -32600,
            'Invalid JSON-RPC 2.0 request.'
          )
        );
        continue;
      }

      const result = await handleMcpRequest(item, token.workspace_id);
      results.push(result);
    }

    return c.json(results);
  }

  // Single request
  if (!validateJsonRpc(body)) {
    return c.json(
      jsonRpcError(null, -32600, 'Invalid JSON-RPC 2.0 request.'),
      400
    );
  }

  const result = await handleMcpRequest(body, token.workspace_id);

  // Set MCP-specific headers
  c.header('Content-Type', 'application/json');
  c.header('X-MCP-Session', `session-${token.workspace_id}`);

  return c.json(result);
});

/**
 * GET /mcp
 *
 * Server-Sent Events endpoint for MCP server-to-client notifications.
 * Used for streaming responses and progress updates.
 */
mcp.get('/mcp', async (c) => {
  const token = c.get('token');

  // Return SSE stream headers -- in production this would open
  // a persistent connection to the workspace MCP server's SSE endpoint
  return c.text('', 200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-MCP-Session': `session-${token.workspace_id}`,
  });
});

/**
 * DELETE /mcp
 *
 * Terminate the MCP session for the current workspace.
 */
mcp.delete('/mcp', async (c) => {
  const token = c.get('token');

  // TODO: Forward session termination to workspace MCP server
  return c.json({
    jsonrpc: '2.0',
    id: 0,
    result: {
      status: 'session_terminated',
      workspace_id: token.workspace_id,
    },
  });
});

// ---------------------------------------------------------------------------
// Internal: MCP request handler
// ---------------------------------------------------------------------------

/**
 * Process a single MCP request.
 *
 * In production, this would HTTP-forward to the workspace MCP server.
 * For now, it returns stub responses for known methods.
 */
async function handleMcpRequest(
  request: McpRequest,
  workspaceId: string
): Promise<McpResponse> {
  const targetUrl = getMcpServerUrl(workspaceId);

  // Recognized MCP methods
  const knownMethods = new Set([
    'initialize',
    'initialized',
    'tools/list',
    'tools/call',
    'resources/list',
    'resources/read',
    'prompts/list',
    'prompts/get',
    'completion/complete',
    'ping',
  ]);

  if (!knownMethods.has(request.method)) {
    return jsonRpcError(request.id, -32601, `Method not found: ${request.method}`);
  }

  // Handle ping locally
  if (request.method === 'ping') {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {},
    };
  }

  // Handle initialize locally (gateway metadata)
  if (request.method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        protocolVersion: '2025-03-26',
        capabilities: {
          tools: { listChanged: true },
          resources: { subscribe: false, listChanged: true },
          prompts: { listChanged: true },
        },
        serverInfo: {
          name: 'llm-ide-gateway',
          version: '0.1.0',
        },
      },
    };
  }

  // For all other methods, proxy to the workspace MCP server
  // TODO: Replace stub with actual HTTP forwarding
  //
  // Production implementation:
  //   const response = await fetch(targetUrl, {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify(request),
  //   });
  //   return await response.json() as McpResponse;

  return {
    jsonrpc: '2.0',
    id: request.id,
    result: {
      _stub: true,
      _note: `Would proxy to ${targetUrl}`,
      method: request.method,
      params: request.params,
      workspace_id: workspaceId,
    },
  };
}

export default mcp;
