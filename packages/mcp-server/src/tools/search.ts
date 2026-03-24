import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Workspace } from '../workspace.js';

export function register(server: McpServer, workspace: Workspace): void {
  server.tool(
    'search_files',
    'Search file contents for a pattern (text or regex).',
    {
      pattern: z.string().describe('Search pattern (string or regex)'),
      path: z.string().optional().describe('Directory to search in'),
      case_sensitive: z.boolean().optional().default(false).describe('Case-sensitive search'),
      whole_word: z.boolean().optional().default(false).describe('Match whole words only'),
      regex: z.boolean().optional().default(false).describe('Treat pattern as regex'),
      include: z.array(z.string()).optional().describe('Glob patterns to include'),
      exclude: z.array(z.string()).optional().describe('Glob patterns to exclude'),
      max_results: z.number().optional().default(50).describe('Maximum results to return'),
    },
    async ({ pattern, path, case_sensitive, whole_word, regex, include, exclude, max_results }) => {
      const results = await workspace.searchFiles(pattern, path, {
        caseSensitive: case_sensitive,
        wholeWord: whole_word,
        regex,
        include,
        exclude,
        maxResults: max_results,
      });
      if (results.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No matches found.' }] };
      }
      const lines = results.map(
        (r) => `${r.file}:${r.line}:${r.column} ${r.context.trim()}`,
      );
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    },
  );

  server.tool(
    'find_files',
    'Find files matching a glob pattern.',
    {
      pattern: z.string().describe('Glob pattern (e.g. "**/*.ts")'),
      path: z.string().optional().describe('Directory to search in'),
    },
    async ({ pattern, path }) => {
      const files = await workspace.findFiles(pattern, path);
      return {
        content: [{ type: 'text' as const, text: files.length > 0 ? files.join('\n') : 'No files found.' }],
      };
    },
  );

  server.tool(
    'get_file_info',
    'Get metadata about a file (size, type, timestamps).',
    { path: z.string().describe('File path') },
    async ({ path }) => {
      const info = await workspace.getFileInfo(path);
      const text = [
        `Path: ${info.path}`,
        `Name: ${info.name}`,
        `Type: ${info.type}`,
        `Size: ${info.size} bytes`,
        `Modified: ${info.modified}`,
        `Created: ${info.created}`,
        `Permissions: ${info.permissions}`,
        info.mimeType ? `MIME: ${info.mimeType}` : null,
      ]
        .filter(Boolean)
        .join('\n');
      return { content: [{ type: 'text' as const, text }] };
    },
  );
}
