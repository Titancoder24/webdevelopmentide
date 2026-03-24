import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Workspace } from '../workspace.js';
import { SCAFFOLD_TEMPLATES } from '../types.js';

const TEMPLATE_NAMES = Object.keys(SCAFFOLD_TEMPLATES) as [string, ...string[]];

export function register(server: McpServer, workspace: Workspace): void {
  server.tool(
    'scaffold_project',
    'Scaffold a new project from a template (react, vue, svelte, express, hono, expo, expo-router, react-native).',
    {
      template: z.enum(TEMPLATE_NAMES).describe('Project template to use'),
      name: z.string().optional().default('my-app').describe('Project name'),
      path: z.string().optional().default('.').describe('Directory to scaffold into'),
    },
    async ({ template, name, path }) => {
      const scaffoldCommands: Record<string, string> = {
        react: `npm create vite@latest ${name} -- --template react-ts`,
        vue: `npm create vite@latest ${name} -- --template vue-ts`,
        svelte: `npm create svelte@latest ${name}`,
        express: `npx --yes express-generator-typescript ${name}`,
        hono: `npm create hono@latest ${name}`,
        expo: `npx --yes create-expo-app@latest ${name}`,
        'expo-router': `npx --yes create-expo-app@latest ${name} --template tabs`,
        'react-native': `npx --yes @react-native-community/cli init ${name}`,
      };

      const command = scaffoldCommands[template];
      if (!command) {
        return {
          content: [{ type: 'text' as const, text: `Unknown template: ${template}` }],
          isError: true,
        };
      }

      const result = await workspace.exec(command, { cwd: path, timeout: 120000 });

      if (result.exitCode !== 0) {
        return {
          content: [{
            type: 'text' as const,
            text: `Scaffold failed (exit ${result.exitCode}):\n${result.stderr || result.stdout}`,
          }],
          isError: true,
        };
      }

      const templateInfo = SCAFFOLD_TEMPLATES[template];
      return {
        content: [{
          type: 'text' as const,
          text: `Scaffolded ${templateInfo.description} at ${path}/${name}\n\n${result.stdout}`,
        }],
      };
    },
  );
}
