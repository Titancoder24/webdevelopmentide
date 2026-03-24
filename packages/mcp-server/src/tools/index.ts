import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Workspace } from '../workspace.js';

import * as fileOps from './file-ops.js';
import * as directory from './directory.js';
import * as search from './search.js';
import * as terminal from './terminal.js';
import * as npm from './npm.js';
import * as scaffold from './scaffold.js';
import * as context from './context.js';
import * as errors from './errors.js';
import * as git from './git.js';
import * as preview from './preview.js';
import * as resource from './resource.js';

const modules = [
  fileOps,
  directory,
  search,
  terminal,
  npm,
  scaffold,
  context,
  errors,
  git,
  preview,
  resource,
];

/**
 * Register all tool modules on the given MCP server instance.
 */
export function registerAllTools(server: McpServer, workspace: Workspace): void {
  for (const mod of modules) {
    mod.register(server, workspace);
  }
}
