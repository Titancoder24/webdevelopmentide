import { createMiddleware } from 'hono/factory';
import type { ApiToken, GatewayEnv } from './types.js';

/**
 * In-memory token store.
 * Will be replaced with Redis + PostgreSQL lookup in production.
 */
const tokenStore = new Map<string, ApiToken>();

/**
 * Register a token in the in-memory store.
 * Used for testing and initial bootstrapping.
 */
export function registerToken(token: ApiToken): void {
  tokenStore.set(token.token_id, token);
}

/**
 * Remove a token from the store.
 */
export function revokeToken(tokenId: string): boolean {
  const token = tokenStore.get(tokenId);
  if (!token) return false;
  token.revoked = true;
  return true;
}

/**
 * Look up a token by its ID.
 */
export function getToken(tokenId: string): ApiToken | undefined {
  return tokenStore.get(tokenId);
}

/**
 * Clear all tokens (useful for testing).
 */
export function clearTokenStore(): void {
  tokenStore.clear();
}

/**
 * Extract the Bearer token from the Authorization header.
 */
function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
}

/**
 * Auth middleware that validates Bearer tokens.
 *
 * Checks:
 * 1. Authorization header is present with Bearer scheme
 * 2. Token exists in the store
 * 3. Token is not revoked
 * 4. Token has not expired
 *
 * On success, sets `token` in the Hono context variables.
 */
export const authMiddleware = createMiddleware<GatewayEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  const tokenId = extractBearerToken(authHeader);

  if (!tokenId) {
    return c.json(
      {
        error: 'unauthorized',
        message: 'Missing or malformed Authorization header. Expected: Bearer <token>',
      },
      401
    );
  }

  const token = tokenStore.get(tokenId);

  if (!token) {
    return c.json(
      {
        error: 'unauthorized',
        message: 'Invalid API token.',
      },
      401
    );
  }

  if (token.revoked) {
    return c.json(
      {
        error: 'unauthorized',
        message: 'Token has been revoked.',
      },
      401
    );
  }

  const now = new Date();
  const expiresAt = new Date(token.expires_at);

  if (now >= expiresAt) {
    return c.json(
      {
        error: 'unauthorized',
        message: 'Token has expired.',
      },
      401
    );
  }

  // Attach the validated token to the context
  c.set('token', token);

  await next();
});

/**
 * Permission-checking middleware factory.
 * Returns middleware that verifies the authenticated token has a specific permission.
 */
export function requirePermission(permission: keyof ApiToken['permissions']) {
  return createMiddleware<GatewayEnv>(async (c, next) => {
    const token = c.get('token');

    if (!token) {
      return c.json(
        { error: 'unauthorized', message: 'Authentication required.' },
        401
      );
    }

    if (!token.permissions[permission]) {
      return c.json(
        {
          error: 'forbidden',
          message: `Token lacks required permission: ${permission}`,
        },
        403
      );
    }

    await next();
  });
}

/**
 * Workspace access middleware.
 * Ensures the token is authorized for the workspace in the URL parameter.
 */
export const workspaceGuard = createMiddleware<GatewayEnv>(async (c, next) => {
  const token = c.get('token');
  const workspaceId = c.req.param('workspace_id');

  if (!token) {
    return c.json(
      { error: 'unauthorized', message: 'Authentication required.' },
      401
    );
  }

  if (workspaceId && token.workspace_id !== workspaceId) {
    return c.json(
      {
        error: 'forbidden',
        message: 'Token is not authorized for this workspace.',
      },
      403
    );
  }

  await next();
});
