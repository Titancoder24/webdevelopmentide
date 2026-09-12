import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Workspace } from '../workspace.js';

export function register(server: McpServer, workspace: Workspace): void {
  server.tool(
    'run_command',
    'Execute a shell command and return its output.',
    {
      command: z.string().describe('Shell command to run'),
      cwd: z.string().optional().describe('Working directory'),
      timeout: z.number().optional().default(30000).describe('Timeout in ms'),
    },
    async ({ command, cwd, timeout }) => {
      const result = await workspace.exec(command, { cwd, timeout });
      const parts: string[] = [];
      if (result.stdout) parts.push(result.stdout);
      if (result.stderr) parts.push(`[stderr]\n${result.stderr}`);
      parts.push(`[exit code: ${result.exitCode}]`);
      return {
        content: [{ type: 'text' as const, text: parts.join('\n') }],
        isError: result.exitCode !== 0,
      };
    },
  );

  server.tool(
    'run_command_background',
    'Start a long-running command in the background and return its PID.',
    {
      command: z.string().describe('Shell command to run'),
      cwd: z.string().optional().describe('Working directory'),
    },
    async ({ command, cwd }) => {
      const { pid } = await workspace.execBackground(command, { cwd });
      return { content: [{ type: 'text' as const, text: `Started background process with PID ${pid}` }] };
    },
  );

  server.tool(
    'kill_process',
    'Terminate a running process by PID.',
    { pid: z.number().describe('Process ID to kill') },
    async ({ pid }) => {
      await workspace.killProcess(pid);
      return { content: [{ type: 'text' as const, text: `Killed process ${pid}` }] };
    },
  );

  server.tool(
    'list_processes',
    'List all running workspace processes.',
    {},
    async () => {
      const procs = await workspace.listProcesses();
      if (procs.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No running processes.' }] };
      }
      const lines = procs.map(
        (p) =>
          `PID ${p.pid} | ${p.running ? 'running' : 'stopped'} | ${p.command}${p.cpu != null ? ` | cpu:${p.cpu}%` : ''}${p.memory != null ? ` | mem:${p.memory}MB` : ''}`,
      );
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    },
  );
}
