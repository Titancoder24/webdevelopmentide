import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Workspace } from '../workspace.js';

export function register(server: McpServer, workspace: Workspace): void {
  server.tool(
    'get_codebase_context',
    'Get a high-level overview of the codebase structure and configuration.',
    {
      include_structure: z.boolean().optional().default(true).describe('Include directory tree'),
      include_package_json: z.boolean().optional().default(true).describe('Include package.json info'),
      include_ts_config: z.boolean().optional().default(false).describe('Include tsconfig info'),
      include_git_info: z.boolean().optional().default(false).describe('Include git branch/status'),
      max_depth: z.number().optional().default(3).describe('Max directory tree depth'),
    },
    async ({ include_structure, include_package_json, include_ts_config, include_git_info, max_depth }) => {
      const context = await workspace.getCodebaseContext({
        includeStructure: include_structure,
        includePackageJson: include_package_json,
        includeTsConfig: include_ts_config,
        includeGitInfo: include_git_info,
        maxDepth: max_depth,
      });
      return { content: [{ type: 'text' as const, text: context }] };
    },
  );

  server.tool(
    'get_file_context',
    'Get a file with its imports and related context for understanding.',
    {
      path: z.string().describe('File path'),
      include_imports: z.boolean().optional().default(true).describe('Resolve and include imported files'),
    },
    async ({ path, include_imports }) => {
      const context = await workspace.getFileContext(path, include_imports);
      return { content: [{ type: 'text' as const, text: context }] };
    },
  );

  server.tool(
    'get_project_summary',
    'Get a concise summary of the project (framework, language, key files).',
    {},
    async () => {
      const summary = await workspace.getProjectSummary();
      return { content: [{ type: 'text' as const, text: summary }] };
    },
  );
}
