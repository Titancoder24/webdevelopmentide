import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Workspace } from '../workspace.js';

export function register(server: McpServer, workspace: Workspace): void {
  server.tool(
    'npm_install',
    'Install npm packages (or all dependencies if no packages specified).',
    {
      packages: z.array(z.string()).optional().describe('Package names to install (omit for "npm install")'),
      dev: z.boolean().optional().default(false).describe('Install as devDependencies'),
    },
    async ({ packages, dev }) => {
      const output = await workspace.npmInstall(packages, dev);
      return { content: [{ type: 'text' as const, text: output }] };
    },
  );

  server.tool(
    'npm_run',
    'Run an npm script defined in package.json.',
    {
      script: z.string().describe('Script name to run'),
      args: z.array(z.string()).optional().describe('Additional arguments'),
    },
    async ({ script, args }) => {
      const result = await workspace.npmRun(script, args);
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
    'list_packages',
    'List installed npm packages and their versions.',
    {},
    async () => {
      const packages = await workspace.listPackages();
      if (packages.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No packages installed.' }] };
      }
      const deps = packages.filter((p) => !p.dev);
      const devDeps = packages.filter((p) => p.dev);
      const lines: string[] = [];
      if (deps.length > 0) {
        lines.push('dependencies:');
        deps.forEach((p) => lines.push(`  ${p.name}@${p.version}`));
      }
      if (devDeps.length > 0) {
        lines.push('devDependencies:');
        devDeps.forEach((p) => lines.push(`  ${p.name}@${p.version}`));
      }
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    },
  );
}
