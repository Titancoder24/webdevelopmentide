import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Workspace } from '../workspace.js';

export function register(server: McpServer, workspace: Workspace): void {
  server.tool(
    'read_file',
    'Read the contents of a file at the given path.',
    { path: z.string().describe('Absolute or workspace-relative file path') },
    async ({ path }) => {
      const content = await workspace.readFile(path);
      return { content: [{ type: 'text' as const, text: content }] };
    },
  );

  server.tool(
    'write_file',
    'Create or overwrite a file with the given content.',
    {
      path: z.string().describe('File path to write'),
      content: z.string().describe('Full file content'),
    },
    async ({ path, content }) => {
      await workspace.writeFile(path, content);
      return { content: [{ type: 'text' as const, text: `Wrote ${path}` }] };
    },
  );

  server.tool(
    'edit_file',
    'Apply a targeted edit to a file by replacing an old string with a new one.',
    {
      path: z.string().describe('File path to edit'),
      old_string: z.string().describe('Exact text to find (must be unique in the file)'),
      new_string: z.string().describe('Replacement text'),
    },
    async ({ path, old_string, new_string }) => {
      const content = await workspace.readFile(path);
      const idx = content.indexOf(old_string);
      if (idx === -1) {
        return {
          content: [{ type: 'text' as const, text: 'Error: old_string not found in file.' }],
          isError: true,
        };
      }
      if (content.indexOf(old_string, idx + 1) !== -1) {
        return {
          content: [{ type: 'text' as const, text: 'Error: old_string matches multiple locations. Provide more context to make it unique.' }],
          isError: true,
        };
      }
      const updated = content.slice(0, idx) + new_string + content.slice(idx + old_string.length);
      await workspace.writeFile(path, updated);
      return { content: [{ type: 'text' as const, text: `Edited ${path}` }] };
    },
  );

  server.tool(
    'delete_file',
    'Delete a file or directory.',
    {
      path: z.string().describe('Path to delete'),
      recursive: z.boolean().optional().describe('Recursively delete directories'),
    },
    async ({ path, recursive }) => {
      await workspace.deleteFile(path, recursive);
      return { content: [{ type: 'text' as const, text: `Deleted ${path}` }] };
    },
  );

  server.tool(
    'move_file',
    'Move or rename a file or directory.',
    {
      source: z.string().describe('Source path'),
      destination: z.string().describe('Destination path'),
    },
    async ({ source, destination }) => {
      await workspace.moveFile(source, destination);
      return { content: [{ type: 'text' as const, text: `Moved ${source} -> ${destination}` }] };
    },
  );

  server.tool(
    'create_files_batch',
    'Create multiple files in a single operation.',
    {
      files: z.array(z.object({
        path: z.string().describe('File path'),
        content: z.string().describe('File content'),
      })).describe('Array of files to create'),
    },
    async ({ files }) => {
      const results: string[] = [];
      for (const file of files) {
        await workspace.writeFile(file.path, file.content);
        results.push(file.path);
      }
      return {
        content: [{ type: 'text' as const, text: `Created ${results.length} files:\n${results.join('\n')}` }],
      };
    },
  );

  server.tool(
    'file_exists',
    'Check whether a file or directory exists.',
    { path: z.string().describe('Path to check') },
    async ({ path }) => {
      const exists = await workspace.fileExists(path);
      return { content: [{ type: 'text' as const, text: exists ? 'true' : 'false' }] };
    },
  );
}
