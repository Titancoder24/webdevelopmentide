export interface ApiToken {
  token_id: string;
  user_id: string;
  workspace_id: string;
  tier: 'free' | 'starter' | 'pro' | 'team' | 'enterprise';
  permissions: {
    file_read: boolean;
    file_write: boolean;
    terminal_exec: boolean;
    npm_install: boolean;
    scaffold: boolean;
    git_push: boolean;
  };
  rate_limits: {
    requests_per_minute: number;
    requests_per_hour: number;
    max_file_size_bytes: number;
    max_command_timeout_seconds: number;
    max_concurrent_processes: number;
  };
  usage_quota: {
    tool_calls_per_month: number;
    storage_bytes: number;
    compute_minutes_per_month: number;
  };
  created_at: string;
  expires_at: string;
  revoked: boolean;
}

export interface AuditLogEntry {
  event_id: string;
  timestamp: string;
  token_id: string;
  user_id: string;
  workspace_id: string;
  tool: string;
  params_hash: string;
  duration_ms: number;
  result_size_bytes: number;
  status: 'success' | 'error' | 'denied';
  cost_units: number;
}

export type PermissionKey = keyof ApiToken['permissions'];

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset_at: number;
  retry_after_ms?: number;
}

export interface TokenBucket {
  tokens: number;
  last_refill: number;
  capacity: number;
  refill_rate: number;
}

export interface WorkspaceFile {
  path: string;
  content: string;
  size_bytes: number;
  modified_at: string;
}

export interface TerminalExecRequest {
  command: string;
  cwd?: string;
  timeout_seconds?: number;
  env?: Record<string, string>;
}

export interface TerminalExecResult {
  exit_code: number;
  stdout: string;
  stderr: string;
  duration_ms: number;
  timed_out: boolean;
}

export interface McpRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface McpResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface GatewayEnv {
  Variables: {
    token: ApiToken;
    request_id: string;
    request_start: number;
  };
}
