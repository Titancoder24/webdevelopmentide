import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Workspace } from '../workspace.js';

export function register(server: McpServer, workspace: Workspace): void {
  server.tool(
    'get_errors',
    'List workspace errors, optionally filtered by status.',
    {
      status: z.enum(['open', 'resolved', 'all']).optional().default('open').describe('Filter by status'),
    },
    async ({ status }) => {
      const errors = await workspace.getErrors(status === 'all' ? undefined : status);
      if (errors.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No errors found.' }] };
      }
      const lines = errors.map(
        (e) => `[${e.severity}] ${e.file}:${e.line}:${e.column} - ${e.message} (${e.source}) [${e.id}]`,
      );
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    },
  );

  server.tool(
    'get_error_detail',
    'Get full details of a specific error including stack trace.',
    { error_id: z.string().describe('Error ID') },
    async ({ error_id }) => {
      const error = await workspace.getErrorDetail(error_id);
      if (!error) {
        return {
          content: [{ type: 'text' as const, text: `Error ${error_id} not found.` }],
          isError: true,
        };
      }
      const parts = [
        `ID: ${error.id}`,
        `Severity: ${error.severity}`,
        `Status: ${error.status}`,
        `Source: ${error.source}`,
        `File: ${error.file}:${error.line}:${error.column}`,
        `Message: ${error.message}`,
        `Time: ${error.timestamp}`,
      ];
      if (error.stack) {
        parts.push(`\nStack trace:\n${error.stack}`);
      }
      return { content: [{ type: 'text' as const, text: parts.join('\n') }] };
    },
  );

  server.tool(
    'resolve_error',
    'Mark an error as resolved.',
    { error_id: z.string().describe('Error ID to resolve') },
    async ({ error_id }) => {
      await workspace.resolveError(error_id);
      return { content: [{ type: 'text' as const, text: `Error ${error_id} marked as resolved.` }] };
    },
  );

  server.tool(
    'clear_errors',
    'Clear all resolved errors from the workspace.',
    {},
    async () => {
      await workspace.clearErrors();
      return { content: [{ type: 'text' as const, text: 'All resolved errors cleared.' }] };
    },
  );

  server.tool(
    'get_error_summary',
    'Get a brief summary of current error counts by severity.',
    {},
    async () => {
      const summary = await workspace.getErrorSummary();
      return { content: [{ type: 'text' as const, text: summary }] };
    },
  );
}
