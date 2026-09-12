import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { registerAllTools } from './tools/index.js';
import type { Workspace } from './workspace.js';

const PORT = parseInt(process.env.MCP_PORT ?? '3100', 10);
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN;

/**
 * Validate the Bearer token on incoming requests when MCP_AUTH_TOKEN is set.
 * Returns true if the request is authorized.
 */
function isAuthorized(req: IncomingMessage): boolean {
  if (!AUTH_TOKEN) return true;
  const header = req.headers.authorization;
  if (!header) return false;
  const [scheme, token] = header.split(' ', 2);
  return scheme === 'Bearer' && token === AUTH_TOKEN;
}

/**
 * Create and start the MCP server with Streamable HTTP transport.
 *
 * @param workspace - The workspace implementation to inject into tools.
 *                    When running standalone (e.g. `npm start`), a real FS-backed
 *                    workspace should be provided by the host process.
 */
export async function startServer(workspace: Workspace): Promise<void> {
  const server = new McpServer({
    name: 'llm-ide-workspace',
    version: '0.1.0',
  });

  registerAllTools(server, workspace);

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // Health check endpoint
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    // Only accept POST on /mcp for the MCP protocol
    if (req.url !== '/mcp') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    // Auth check
    if (!isAuthorized(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    // Create a fresh transport per request for stateless Streamable HTTP
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    // Connect the MCP server to this transport
    await server.connect(transport);

    // Hand the request to the transport
    await transport.handleRequest(req, res);
  });

  httpServer.listen(PORT, () => {
    console.log(`MCP server listening on http://localhost:${PORT}/mcp`);
  });
}

// Re-export core types for consumers of this package
export type { Workspace } from './workspace.js';
export { registerAllTools } from './tools/index.js';
export * from './types.js';
