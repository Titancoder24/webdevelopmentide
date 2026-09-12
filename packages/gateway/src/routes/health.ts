import { Hono } from 'hono';

const VERSION = '0.1.0';
const startedAt = Date.now();

const health = new Hono();

/**
 * GET /health
 * Basic health check endpoint. No authentication required.
 */
health.get('/health', (c) => {
  const uptimeMs = Date.now() - startedAt;
  const uptimeSeconds = Math.floor(uptimeMs / 1000);

  return c.json({
    status: 'ok',
    version: VERSION,
    uptime: uptimeSeconds,
    uptime_formatted: formatUptime(uptimeSeconds),
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /ready
 * Readiness probe. Returns 200 when the gateway is ready to accept traffic.
 */
health.get('/ready', (c) => {
  // In production, this would check downstream service connectivity
  // (Redis, PostgreSQL, MCP server, etc.)
  return c.json({
    status: 'ready',
    checks: {
      token_store: 'ok',
      rate_limiter: 'ok',
      audit_log: 'ok',
    },
  });
});

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(' ');
}

export default health;
