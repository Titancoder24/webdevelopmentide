import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Workspace } from '../workspace.js';

export function register(server: McpServer, workspace: Workspace): void {
  server.tool(
    'list_directory',
    'List files and directories at a given path.',
    {
      path: z.string().optional().default('.').describe('Directory path (default: workspace root)'),
      recursive: z.boolean().optional().default(false).describe('List recursively'),
    },
    async ({ path, recursive }) => {
      const entries = await workspace.listDirectory(path, recursive);
      const lines = entries.map(
        (e) => `${e.type === 'directory' ? 'd' : 'f'} ${e.path}${e.size != null ? ` (${e.size}B)` : ''}`,
      );
      return { content: [{ type: 'text' as const, text: lines.join('\n') || '(empty directory)' }] };
    },
  );

  server.tool(
    'create_directory',
    'Create a directory (including parent directories).',
    { path: z.string().describe('Directory path to create') },
    async ({ path }) => {
      await workspace.createDirectory(path);
      return { content: [{ type: 'text' as const, text: `Created directory ${path}` }] };
    },
  );

  server.tool(
    'directory_tree',
    'Get a visual tree representation of a directory structure.',
    {
      path: z.string().optional().default('.').describe('Root directory path'),
      depth: z.number().optional().default(4).describe('Maximum depth to traverse'),
    },
    async ({ path, depth }) => {
      const tree = await workspace.directoryTree(path, depth);
      return { content: [{ type: 'text' as const, text: tree }] };
    },
  );
}
