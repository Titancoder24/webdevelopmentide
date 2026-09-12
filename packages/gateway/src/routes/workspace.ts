import { Hono } from 'hono';
import { requirePermission, workspaceGuard } from '../auth.js';
import type { GatewayEnv } from '../types.js';

/**
 * Workspace REST API routes.
 *
 * These routes proxy to the MCP server tools via HTTP.
 * In production, the handler bodies would forward requests to the
 * MCP server running alongside each workspace container.
 *
 * All routes require authentication and workspace access.
 */
const workspace = new Hono<GatewayEnv>();

// All workspace routes require workspace access verification
workspace.use('/api/v1/:workspace_id/*', workspaceGuard);

// ---------------------------------------------------------------------------
// File operations
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/:workspace_id/files/*
 * Read a file from the workspace.
 */
workspace.get(
  '/api/v1/:workspace_id/files/*',
  requirePermission('file_read'),
  async (c) => {
    const workspaceId = c.req.param('workspace_id');
    const filePath = c.req.path.replace(`/api/v1/${workspaceId}/files/`, '');

    // TODO: Forward to MCP server's file_read tool
    // For now, return a stub response indicating the proxy target
    return c.json({
      workspace_id: workspaceId,
      path: decodeURIComponent(filePath),
      action: 'read',
      _proxy_to: `mcp://workspace-${workspaceId}/file_read`,
      _note: 'This will proxy to the MCP server file_read tool',
    });
  }
);

/**
 * PUT /api/v1/:workspace_id/files/*
 * Write/update a file in the workspace.
 */
workspace.put(
  '/api/v1/:workspace_id/files/*',
  requirePermission('file_write'),
  async (c) => {
    const workspaceId = c.req.param('workspace_id');
    const filePath = c.req.path.replace(`/api/v1/${workspaceId}/files/`, '');

    const body = await c.req.json<{ content: string; create_dirs?: boolean }>().catch(() => null);

    if (!body || typeof body.content !== 'string') {
      return c.json(
        { error: 'bad_request', message: 'Request body must include "content" as a string.' },
        400
      );
    }

    const token = c.get('token');
    const contentSize = new TextEncoder().encode(body.content).byteLength;

    if (contentSize > token.rate_limits.max_file_size_bytes) {
      return c.json(
        {
          error: 'payload_too_large',
          message: `File size ${contentSize} bytes exceeds limit of ${token.rate_limits.max_file_size_bytes} bytes.`,
        },
        413
      );
    }

    // TODO: Forward to MCP server's file_write tool
    return c.json({
      workspace_id: workspaceId,
      path: decodeURIComponent(filePath),
      action: 'write',
      size_bytes: contentSize,
      _proxy_to: `mcp://workspace-${workspaceId}/file_write`,
    });
  }
);

/**
 * DELETE /api/v1/:workspace_id/files/*
 * Delete a file from the workspace.
 */
workspace.delete(
  '/api/v1/:workspace_id/files/*',
  requirePermission('file_write'),
  async (c) => {
    const workspaceId = c.req.param('workspace_id');
    const filePath = c.req.path.replace(`/api/v1/${workspaceId}/files/`, '');

    // TODO: Forward to MCP server's file_delete tool
    return c.json({
      workspace_id: workspaceId,
      path: decodeURIComponent(filePath),
      action: 'delete',
      _proxy_to: `mcp://workspace-${workspaceId}/file_delete`,
    });
  }
);

// ---------------------------------------------------------------------------
// Terminal operations
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/:workspace_id/terminal
 * Execute a command in the workspace terminal.
 */
workspace.post(
  '/api/v1/:workspace_id/terminal',
  requirePermission('terminal_exec'),
  async (c) => {
    const workspaceId = c.req.param('workspace_id');
    const token = c.get('token');

    const body = await c.req.json<{
      command: string;
      cwd?: string;
      timeout_seconds?: number;
      env?: Record<string, string>;
    }>().catch(() => null);

    if (!body || typeof body.command !== 'string' || body.command.trim() === '') {
      return c.json(
        { error: 'bad_request', message: 'Request body must include a non-empty "command" string.' },
        400
      );
    }

    const timeout = Math.min(
      body.timeout_seconds ?? token.rate_limits.max_command_timeout_seconds,
      token.rate_limits.max_command_timeout_seconds
    );

    // TODO: Forward to MCP server's terminal_exec tool
    return c.json({
      workspace_id: workspaceId,
      command: body.command,
      cwd: body.cwd ?? '/workspace',
      timeout_seconds: timeout,
      action: 'terminal_exec',
      _proxy_to: `mcp://workspace-${workspaceId}/terminal_exec`,
    });
  }
);

// ---------------------------------------------------------------------------
// NPM operations
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/:workspace_id/npm/install
 * Install npm packages in the workspace.
 */
workspace.post(
  '/api/v1/:workspace_id/npm/install',
  requirePermission('npm_install'),
  async (c) => {
    const workspaceId = c.req.param('workspace_id');

    const body = await c.req.json<{
      packages: string[];
      dev?: boolean;
    }>().catch(() => null);

    if (!body || !Array.isArray(body.packages) || body.packages.length === 0) {
      return c.json(
        { error: 'bad_request', message: 'Request body must include a non-empty "packages" array.' },
        400
      );
    }

    // TODO: Forward to MCP server's npm_install tool
    return c.json({
      workspace_id: workspaceId,
      packages: body.packages,
      dev: body.dev ?? false,
      action: 'npm_install',
      _proxy_to: `mcp://workspace-${workspaceId}/npm_install`,
    });
  }
);

// ---------------------------------------------------------------------------
// Scaffold operations
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/:workspace_id/scaffold
 * Scaffold a new project structure in the workspace.
 */
workspace.post(
  '/api/v1/:workspace_id/scaffold',
  requirePermission('scaffold'),
  async (c) => {
    const workspaceId = c.req.param('workspace_id');

    const body = await c.req.json<{
      template: string;
      name: string;
      options?: Record<string, unknown>;
    }>().catch(() => null);

    if (!body || typeof body.template !== 'string' || typeof body.name !== 'string') {
      return c.json(
        { error: 'bad_request', message: 'Request body must include "template" and "name" strings.' },
        400
      );
    }

    // TODO: Forward to MCP server's scaffold tool
    return c.json({
      workspace_id: workspaceId,
      template: body.template,
      name: body.name,
      options: body.options ?? {},
      action: 'scaffold',
      _proxy_to: `mcp://workspace-${workspaceId}/scaffold`,
    });
  }
);

// ---------------------------------------------------------------------------
// Git operations
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/:workspace_id/git/push
 * Push changes to the remote repository.
 */
workspace.post(
  '/api/v1/:workspace_id/git/push',
  requirePermission('git_push'),
  async (c) => {
    const workspaceId = c.req.param('workspace_id');

    const body = await c.req.json<{
      remote?: string;
      branch?: string;
      force?: boolean;
    }>().catch(() => null);

    // TODO: Forward to MCP server's git_push tool
    return c.json({
      workspace_id: workspaceId,
      remote: body?.remote ?? 'origin',
      branch: body?.branch ?? 'main',
      force: body?.force ?? false,
      action: 'git_push',
      _proxy_to: `mcp://workspace-${workspaceId}/git_push`,
    });
  }
);

// ---------------------------------------------------------------------------
// File listing
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/:workspace_id/tree
 * List the file tree of the workspace.
 */
workspace.get(
  '/api/v1/:workspace_id/tree',
  requirePermission('file_read'),
  async (c) => {
    const workspaceId = c.req.param('workspace_id');
    const depth = parseInt(c.req.query('depth') ?? '3', 10);

    // TODO: Forward to MCP server's file_tree tool
    return c.json({
      workspace_id: workspaceId,
      depth,
      action: 'file_tree',
      _proxy_to: `mcp://workspace-${workspaceId}/file_tree`,
    });
  }
);

export default workspace;
