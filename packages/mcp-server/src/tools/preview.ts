import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Workspace } from '../workspace.js';

export function register(server: McpServer, workspace: Workspace): void {
  server.tool(
    'get_preview_url',
    'Get the preview URL for the running dev server.',
    {
      port: z.number().optional().default(3000).describe('Server port number'),
    },
    async ({ port }) => {
      const url = await workspace.getPreviewUrl(port);
      return { content: [{ type: 'text' as const, text: url }] };
    },
  );

  server.tool(
    'get_server_logs',
    'Get recent logs from the running dev server.',
    {
      lines: z.number().optional().default(50).describe('Number of recent log lines'),
    },
    async ({ lines }) => {
      const logs = await workspace.getServerLogs(lines);
      return { content: [{ type: 'text' as const, text: logs || '(no logs)' }] };
    },
  );
}
