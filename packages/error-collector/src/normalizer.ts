import type { RawErrorData, WorkspaceError, ErrorSeverity } from './types.js';

let counter = 0;

function generateId(): string {
  counter++;
  const timestamp = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `err_${timestamp}_${rand}_${counter}`;
}

/**
 * Extract file, line, and column from a Node.js-style stack trace.
 * Looks for patterns like:
 *   at functionName (/path/to/file.ts:10:5)
 *   at /path/to/file.ts:10:5
 */
function parseStackTrace(stack: string): { file?: string; line?: number; column?: number; related_files: string[] } {
  const related_files: string[] = [];
  let file: string | undefined;
  let line: number | undefined;
  let column: number | undefined;

  const frameRegex = /at\s+(?:.*?\s+\()?([^()]+?):(\d+):(\d+)\)?/g;
  let match: RegExpExecArray | null;
  let isFirst = true;

  while ((match = frameRegex.exec(stack)) !== null) {
    const framePath = match[1];
    const frameLine = parseInt(match[2], 10);
    const frameCol = parseInt(match[3], 10);

    // Skip node internals
    if (framePath.startsWith('node:') || framePath.includes('node_modules')) {
      continue;
    }

    if (isFirst) {
      file = framePath;
      line = frameLine;
      column = frameCol;
      isFirst = false;
    }

    if (!related_files.includes(framePath)) {
      related_files.push(framePath);
    }
  }

  return { file, line, column, related_files };
}

/**
 * Infer error type from the message if not explicitly provided.
 */
function inferType(message: string, source: string): string {
  // TypeScript errors
  const tsMatch = message.match(/error TS(\d+)/);
  if (tsMatch) return `TS${tsMatch[1]}`;

  // Common JS/TS error types
  if (message.includes('TypeError')) return 'TypeError';
  if (message.includes('ReferenceError')) return 'ReferenceError';
  if (message.includes('SyntaxError')) return 'SyntaxError';
  if (message.includes('RangeError')) return 'RangeError';
  if (message.includes('URIError')) return 'URIError';
  if (message.includes('EvalError')) return 'EvalError';

  // ESLint rules
  const eslintMatch = message.match(/\(([a-z@/-]+\/[a-z-]+|[a-z-]+)\)$/);
  if (eslintMatch) return eslintMatch[1];

  // Build tool specific
  if (source === 'build') return 'BuildError';
  if (source === 'lint') return 'LintError';
  if (source === 'terminal') return 'ProcessError';
  if (source === 'runtime') return 'RuntimeError';
  if (source === 'preview') return 'PreviewError';
  if (source === 'test') return 'TestError';

  return 'UnknownError';
}

/**
 * Infer severity when not explicitly provided.
 */
function inferSeverity(message: string, source: string): ErrorSeverity {
  const lower = message.toLowerCase();
  if (lower.includes('warning') || lower.includes('warn')) return 'warning';
  if (lower.includes('info') || lower.includes('note')) return 'info';
  return 'error';
}

/**
 * Normalize raw error data from any source into a structured WorkspaceError.
 */
export function normalize(raw: RawErrorData): WorkspaceError {
  const now = new Date().toISOString();

  // Try to extract file/line/column from stack trace if not already set
  let { file, line, column } = raw;
  let stackRelatedFiles: string[] = [];

  if (raw.stack_trace) {
    const parsed = parseStackTrace(raw.stack_trace);
    if (!file && parsed.file) file = parsed.file;
    if (!line && parsed.line) line = parsed.line;
    if (!column && parsed.column) column = parsed.column;
    stackRelatedFiles = parsed.related_files;
  }

  // Merge related files from raw data and stack trace parsing
  const relatedSet = new Set<string>([
    ...(raw.related_files ?? []),
    ...stackRelatedFiles,
  ]);
  // Remove the primary file from related_files
  if (file) relatedSet.delete(file);
  const related_files = Array.from(relatedSet);

  const severity = raw.severity ?? inferSeverity(raw.message, raw.source);
  const type = raw.type ?? inferType(raw.message, raw.source);

  return {
    id: generateId(),
    timestamp: now,
    source: raw.source,
    severity,
    type,
    message: raw.message.trim(),
    file,
    line,
    column,
    stack_trace: raw.stack_trace,
    code_snippet: raw.code_snippet,
    related_files,
    status: 'open',
    resolved_by: null,
    occurrences: 1,
    first_seen: now,
    last_seen: now,
  };
}
