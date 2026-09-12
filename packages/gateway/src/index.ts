import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requestId } from 'hono/request-id';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';

import type { GatewayEnv } from './types.js';
import { authMiddleware } from './auth.js';
import { rateLimitMiddleware } from './rate-limiter.js';
import { auditMiddleware } from './audit-log.js';
import health from './routes/health.js';
import workspace from './routes/workspace.js';
import mcp from './routes/mcp.js';

// ---------------------------------------------------------------------------
// Create the Hono application
// ---------------------------------------------------------------------------

const app = new Hono<GatewayEnv>();

// ---------------------------------------------------------------------------
// Global middleware (applied to all routes)
// ---------------------------------------------------------------------------

/**
 * Request ID -- attaches a unique ID to every request for tracing.
 */
app.use('*', requestId());

/**
 * Request logger -- logs method, path, status, and duration.
 */
app.use('*', logger());

/**
 * CORS -- allow cross-origin requests from IDE frontends.
 * In production, the allowed origins would be configured via environment variables.
 */
app.use(
  '*',
  cors({
    origin: [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://*.llm-ide.dev',
    ],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-MCP-Session'],
    exposeHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'X-Request-ID',
      'X-MCP-Session',
      'Retry-After',
    ],
    maxAge: 86400,
    credentials: true,
  })
);

// ---------------------------------------------------------------------------
// Health routes (unauthenticated)
// ---------------------------------------------------------------------------

app.route('/', health);

// ---------------------------------------------------------------------------
// Authenticated routes -- auth, rate limiting, and audit logging
// ---------------------------------------------------------------------------

/**
 * Authentication middleware for /api and /mcp routes.
 * Validates the Bearer token and attaches it to the context.
 */
app.use('/api/*', authMiddleware);
app.use('/mcp', authMiddleware);

/**
 * Rate limiting middleware for authenticated routes.
 * Enforces per-token request limits (per-minute and per-hour).
 */
app.use('/api/*', rateLimitMiddleware);
app.use('/mcp', rateLimitMiddleware);

/**
 * Audit logging middleware for authenticated routes.
 * Records every tool call with timing, status, and cost information.
 */
app.use('/api/*', auditMiddleware);
app.use('/mcp', auditMiddleware);

// ---------------------------------------------------------------------------
// Application routes
// ---------------------------------------------------------------------------

app.route('/', workspace);
app.route('/', mcp);

// ---------------------------------------------------------------------------
// 404 fallback
// ---------------------------------------------------------------------------

app.notFound((c) => {
  return c.json(
    {
      error: 'not_found',
      message: `Route not found: ${c.req.method} ${c.req.path}`,
    },
    404
  );
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------

app.onError((err, c) => {
  console.error(`[gateway] Unhandled error: ${err.message}`, err.stack);

  return c.json(
    {
      error: 'internal_server_error',
      message:
        process.env.NODE_ENV === 'production'
          ? 'An internal error occurred.'
          : err.message,
    },
    500
  );
});

// ---------------------------------------------------------------------------
// Start the server
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.GATEWAY_PORT ?? '3001', 10);

console.log(`[gateway] LLM-Native Cloud IDE API Gateway`);
console.log(`[gateway] Starting on port ${PORT}...`);

serve(
  {
    fetch: app.fetch,
    port: PORT,
  },
  (info) => {
    console.log(`[gateway] Server listening on http://localhost:${info.port}`);
    console.log(`[gateway] Health:    GET  http://localhost:${info.port}/health`);
    console.log(`[gateway] Readiness: GET  http://localhost:${info.port}/ready`);
    console.log(`[gateway] API:       /api/v1/:workspace_id/...`);
    console.log(`[gateway] MCP:       POST http://localhost:${info.port}/mcp`);
  }
);

export default app;
