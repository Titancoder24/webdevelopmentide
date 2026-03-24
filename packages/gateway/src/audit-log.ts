import { createMiddleware } from 'hono/factory';
import type { AuditLogEntry, GatewayEnv } from './types.js';

/**
 * In-memory audit log buffer.
 * In production, this would flush to PostgreSQL / a log aggregation service.
 */
const auditBuffer: AuditLogEntry[] = [];

const MAX_BUFFER_SIZE = 10_000;

/**
 * Generate a simple unique event ID.
 */
function generateEventId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `evt_${timestamp}_${random}`;
}

/**
 * Generate a simple hash of parameters for logging.
 * Not cryptographic -- just for identifying duplicate calls.
 */
function hashParams(params: unknown): string {
  try {
    const str = JSON.stringify(params ?? {});
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  } catch {
    return '00000000';
  }
}

/**
 * Determine the tool name from the request method and path.
 */
function resolveToolName(method: string, path: string): string {
  if (path.includes('/mcp')) return 'mcp';
  if (path.includes('/terminal')) return 'terminal_exec';
  if (path.includes('/files')) {
    switch (method) {
      case 'GET': return 'file_read';
      case 'PUT': return 'file_write';
      case 'DELETE': return 'file_delete';
      default: return 'file_unknown';
    }
  }
  if (path.includes('/npm')) return 'npm_install';
  if (path.includes('/scaffold')) return 'scaffold';
  if (path.includes('/git')) return 'git_push';
  return `${method.toLowerCase()}:${path}`;
}

/**
 * Estimate the cost units for a given tool call.
 * Cost units are used for billing and quota tracking.
 */
function estimateCostUnits(tool: string, durationMs: number, resultSizeBytes: number): number {
  const baseCost: Record<string, number> = {
    file_read: 1,
    file_write: 2,
    file_delete: 1,
    terminal_exec: 5,
    npm_install: 10,
    scaffold: 8,
    git_push: 3,
    mcp: 5,
  };

  const base = baseCost[tool] ?? 1;
  // Add extra cost for long-running or large operations
  const durationMultiplier = Math.max(1, Math.ceil(durationMs / 5000));
  const sizeMultiplier = Math.max(1, Math.ceil(resultSizeBytes / (1024 * 1024)));

  return base * durationMultiplier * sizeMultiplier;
}

/**
 * Record an audit log entry directly (for programmatic use).
 */
export function recordAuditEntry(entry: AuditLogEntry): void {
  auditBuffer.push(entry);

  // Evict oldest entries if buffer exceeds max size
  if (auditBuffer.length > MAX_BUFFER_SIZE) {
    auditBuffer.splice(0, auditBuffer.length - MAX_BUFFER_SIZE);
  }
}

/**
 * Get all audit log entries (for inspection/testing).
 */
export function getAuditLog(): ReadonlyArray<AuditLogEntry> {
  return auditBuffer;
}

/**
 * Get audit log entries filtered by workspace.
 */
export function getAuditLogForWorkspace(workspaceId: string): AuditLogEntry[] {
  return auditBuffer.filter((e) => e.workspace_id === workspaceId);
}

/**
 * Get audit log entries filtered by token.
 */
export function getAuditLogForToken(tokenId: string): AuditLogEntry[] {
  return auditBuffer.filter((e) => e.token_id === tokenId);
}

/**
 * Flush the audit buffer and return all entries.
 * In production, this would persist to a database.
 */
export function flushAuditLog(): AuditLogEntry[] {
  const entries = [...auditBuffer];
  auditBuffer.length = 0;
  return entries;
}

/**
 * Clear the audit log (useful for testing).
 */
export function clearAuditLog(): void {
  auditBuffer.length = 0;
}

/**
 * Audit logging middleware.
 *
 * Captures every request that passes through authenticated routes:
 * - Tool name (derived from method + path)
 * - Parameter hash
 * - Duration
 * - Response size
 * - Status (success / error / denied)
 */
export const auditMiddleware = createMiddleware<GatewayEnv>(async (c, next) => {
  const startTime = Date.now();
  const token = c.get('token');

  // Store the start time for downstream use
  c.set('request_start', startTime);

  await next();

  // After the response is generated, record the audit entry
  const durationMs = Date.now() - startTime;
  const method = c.req.method;
  const path = c.req.path;
  const tool = resolveToolName(method, path);

  // Estimate result size from Content-Length header or response body
  const contentLength = c.res.headers.get('Content-Length');
  const resultSizeBytes = contentLength ? parseInt(contentLength, 10) : 0;

  // Determine status from HTTP status code
  let status: AuditLogEntry['status'];
  if (c.res.status === 403) {
    status = 'denied';
  } else if (c.res.status >= 400) {
    status = 'error';
  } else {
    status = 'success';
  }

  const costUnits = estimateCostUnits(tool, durationMs, resultSizeBytes);

  // Hash the URL params as a request fingerprint
  const paramsHash = hashParams({
    path: c.req.path,
    query: c.req.query(),
  });

  const entry: AuditLogEntry = {
    event_id: generateEventId(),
    timestamp: new Date(startTime).toISOString(),
    token_id: token?.token_id ?? 'anonymous',
    user_id: token?.user_id ?? 'anonymous',
    workspace_id: token?.workspace_id ?? c.req.param('workspace_id') ?? 'unknown',
    tool,
    params_hash: paramsHash,
    duration_ms: durationMs,
    result_size_bytes: resultSizeBytes,
    status,
    cost_units: costUnits,
  };

  recordAuditEntry(entry);
});
