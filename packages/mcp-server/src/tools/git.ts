import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Workspace } from '../workspace.js';

export function register(server: McpServer, workspace: Workspace): void {
  server.tool(
    'git_status',
    'Show the current git working tree status.',
    {},
    async () => {
      const status = await workspace.gitStatus();
      return { content: [{ type: 'text' as const, text: status }] };
    },
  );

  server.tool(
    'git_commit',
    'Stage files and create a git commit.',
    {
      message: z.string().describe('Commit message'),
      files: z.array(z.string()).optional().describe('Files to stage (omit to stage all changes)'),
    },
    async ({ message, files }) => {
      const result = await workspace.gitCommit(message, files);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  server.tool(
    'git_diff',
    'Show git diff for the workspace or a specific file.',
    {
      file: z.string().optional().describe('File path (omit for full diff)'),
    },
    async ({ file }) => {
      const diff = await workspace.gitDiff(file);
      return { content: [{ type: 'text' as const, text: diff || '(no changes)' }] };
    },
  );
}
