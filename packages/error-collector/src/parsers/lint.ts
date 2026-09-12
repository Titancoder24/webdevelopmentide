import type { RawErrorData, ErrorSeverity } from '../types.js';

/**
 * ESLint JSON output format (from `eslint --format json`).
 */
interface ESLintMessage {
  ruleId: string | null;
  severity: 1 | 2; // 1 = warning, 2 = error
  message: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  fix?: {
    range: [number, number];
    text: string;
  };
}

interface ESLintResult {
  filePath: string;
  messages: ESLintMessage[];
  errorCount: number;
  warningCount: number;
}

function mapSeverity(eslintSeverity: 1 | 2): ErrorSeverity {
  return eslintSeverity === 2 ? 'error' : 'warning';
}

/**
 * Parse ESLint JSON output string into raw error data.
 *
 * Expects the output from `eslint --format json` which is an array of result objects.
 */
export function parseESLintJson(jsonOutput: string): RawErrorData[] {
  const errors: RawErrorData[] = [];

  let results: ESLintResult[];
  try {
    results = JSON.parse(jsonOutput);
  } catch {
    // If JSON parsing fails, try to parse as plain text ESLint output
    return parseESLintText(jsonOutput);
  }

  if (!Array.isArray(results)) {
    return errors;
  }

  for (const result of results) {
    if (!result.messages || result.messages.length === 0) continue;

    for (const msg of result.messages) {
      const ruleId = msg.ruleId ?? 'unknown-rule';
      errors.push({
        source: 'lint',
        severity: mapSeverity(msg.severity),
        type: ruleId,
        message: `${msg.message} (${ruleId})`,
        file: result.filePath,
        line: msg.line,
        column: msg.column,
      });
    }
  }

  return errors;
}

/**
 * Parse ESLint stylish/default text output as a fallback.
 *
 * Format:
 *   /path/to/file.ts
 *     10:5  error  Unexpected var  no-var
 *     15:1  warning  Missing return type  @typescript-eslint/explicit-function-return-type
 */
const eslintTextLineRegex = /^\s*(\d+):(\d+)\s+(error|warning)\s+(.+?)\s{2,}(\S+)\s*$/;

export function parseESLintText(textOutput: string): RawErrorData[] {
  const errors: RawErrorData[] = [];
  const lines = textOutput.split('\n');
  let currentFile: string | undefined;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // File path line (starts with / or drive letter, no leading whitespace)
    if (!line.startsWith(' ') && !line.startsWith('\t') && (trimmed.startsWith('/') || /^[a-zA-Z]:/.test(trimmed))) {
      currentFile = trimmed;
      continue;
    }

    const match = line.match(eslintTextLineRegex);
    if (match && currentFile) {
      const severity: ErrorSeverity = match[3] === 'error' ? 'error' : 'warning';
      const ruleId = match[5];
      errors.push({
        source: 'lint',
        severity,
        type: ruleId,
        message: `${match[4]} (${ruleId})`,
        file: currentFile,
        line: parseInt(match[1], 10),
        column: parseInt(match[2], 10),
      });
    }
  }

  return errors;
}
