import type { RawErrorData } from '../types.js';

/**
 * Parse terminal stderr output and exit codes into raw error data.
 *
 * Handles common patterns:
 * - Node.js errors with stack traces
 * - Command not found
 * - Permission denied
 * - Generic process exit with non-zero code
 * - npm/yarn/pnpm script errors
 * - ENOENT and other system errors
 */

// Pattern: "Error: <message>" followed by a stack trace
const nodeErrorRegex = /^(\w*Error):\s*(.+)/;

// Pattern: "command not found: <cmd>" or "bash: <cmd>: command not found"
const cmdNotFoundRegex = /(?:command not found:\s*(.+)|bash:\s*(.+?):\s*command not found)/;

// Pattern: "Permission denied" errors
const permissionDeniedRegex = /permission denied[:\s]*(.+)?/i;

// Pattern: ENOENT, EACCES, etc.
const systemErrorRegex = /^(E[A-Z]+):\s*(.+)/;

// Pattern: "/path/to/file:line:col: message"
const fileLineRegex = /^([^\s:]+):(\d+):(\d+):\s*(.+)/;

export function parseTerminalOutput(
  stderr: string,
  exitCode?: number
): RawErrorData[] {
  const errors: RawErrorData[] = [];
  const lines = stderr.trim().split('\n');

  if (!stderr.trim() && exitCode !== undefined && exitCode !== 0) {
    errors.push({
      source: 'terminal',
      severity: 'error',
      type: 'ProcessError',
      message: `Process exited with code ${exitCode}`,
    });
    return errors;
  }

  // Try to parse as a single error with stack trace
  const fullText = stderr.trim();

  // Check for Node.js-style error with stack trace
  const nodeMatch = fullText.match(nodeErrorRegex);
  if (nodeMatch) {
    const stackLines: string[] = [];
    let inStack = false;

    for (const line of lines) {
      if (line.match(/^\s+at\s+/)) {
        inStack = true;
        stackLines.push(line);
      } else if (inStack) {
        break;
      }
    }

    errors.push({
      source: 'terminal',
      severity: 'error',
      type: nodeMatch[1],
      message: nodeMatch[2],
      stack_trace: stackLines.length > 0 ? [lines[0], ...stackLines].join('\n') : undefined,
    });

    return errors;
  }

  // Parse line by line for other patterns
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Command not found
    const cmdMatch = line.match(cmdNotFoundRegex);
    if (cmdMatch) {
      const cmd = cmdMatch[1] ?? cmdMatch[2];
      errors.push({
        source: 'terminal',
        severity: 'error',
        type: 'CommandNotFound',
        message: `Command not found: ${cmd}`,
      });
      continue;
    }

    // Permission denied
    const permMatch = line.match(permissionDeniedRegex);
    if (permMatch) {
      errors.push({
        source: 'terminal',
        severity: 'error',
        type: 'PermissionDenied',
        message: line,
      });
      continue;
    }

    // System errors (ENOENT, EACCES, etc.)
    const sysMatch = line.match(systemErrorRegex);
    if (sysMatch) {
      errors.push({
        source: 'terminal',
        severity: 'error',
        type: sysMatch[1],
        message: sysMatch[2],
      });
      continue;
    }

    // File:line:col pattern
    const fileMatch = line.match(fileLineRegex);
    if (fileMatch) {
      errors.push({
        source: 'terminal',
        severity: 'error',
        message: fileMatch[4],
        file: fileMatch[1],
        line: parseInt(fileMatch[2], 10),
        column: parseInt(fileMatch[3], 10),
      });
      continue;
    }
  }

  // If no specific patterns matched but there's stderr and a non-zero exit code
  if (errors.length === 0 && exitCode !== undefined && exitCode !== 0) {
    errors.push({
      source: 'terminal',
      severity: 'error',
      type: 'ProcessError',
      message: stderr.trim().split('\n')[0] || `Process exited with code ${exitCode}`,
    });
  }

  return errors;
}
