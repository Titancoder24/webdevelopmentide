import type { RawErrorData, ErrorSeverity } from '../types.js';

/**
 * Parse TypeScript compiler (tsc) error output.
 *
 * Formats:
 *   src/foo.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.
 *   src/foo.ts:10:5 - error TS2322: Type 'string' is not assignable to type 'number'.
 */
const tscParenRegex = /^(.+?)\((\d+),(\d+)\):\s*(error|warning)\s+(TS\d+):\s*(.+)$/;
const tscColonRegex = /^(.+?):(\d+):(\d+)\s*-\s*(error|warning)\s+(TS\d+):\s*(.+)$/;

function parseTscLine(line: string): RawErrorData | null {
  const parenMatch = line.match(tscParenRegex);
  if (parenMatch) {
    return {
      source: 'build',
      severity: parenMatch[4] as ErrorSeverity,
      type: parenMatch[5],
      message: `${parenMatch[5]}: ${parenMatch[6]}`,
      file: parenMatch[1],
      line: parseInt(parenMatch[2], 10),
      column: parseInt(parenMatch[3], 10),
    };
  }

  const colonMatch = line.match(tscColonRegex);
  if (colonMatch) {
    return {
      source: 'build',
      severity: colonMatch[4] as ErrorSeverity,
      type: colonMatch[5],
      message: `${colonMatch[5]}: ${colonMatch[6]}`,
      file: colonMatch[1],
      line: parseInt(colonMatch[2], 10),
      column: parseInt(colonMatch[3], 10),
    };
  }

  return null;
}

/**
 * Parse Vite build error output.
 *
 * Formats:
 *   [vite] Internal server error: <message>
 *   error during build:
 *   x Build failed with N errors
 *   ERROR  <file>:<line>:<col>
 *
 * Vite often wraps esbuild or Rollup errors:
 *   src/App.tsx:15:4: ERROR: ...
 */
const viteInternalRegex = /\[vite\]\s*(?:Internal server error:\s*)?(.+)/;
const viteFileErrorRegex = /^(?:ERROR\s+)?(.+?):(\d+):(\d+):\s*(?:ERROR:\s*)?(.+)$/;
// Rollup-style: "Could not resolve" etc.
const rollupResolveRegex = /Could not resolve ['"](.+?)['"]\s*(?:from\s+['"](.+?)['"])?/;

function parseViteLine(line: string): RawErrorData | null {
  const viteMatch = line.match(viteInternalRegex);
  if (viteMatch) {
    return {
      source: 'build',
      severity: 'error',
      type: 'ViteBuildError',
      message: viteMatch[1],
    };
  }

  const rollupMatch = line.match(rollupResolveRegex);
  if (rollupMatch) {
    return {
      source: 'build',
      severity: 'error',
      type: 'ResolveError',
      message: line.trim(),
      file: rollupMatch[2],
      related_files: [rollupMatch[1]],
    };
  }

  return null;
}

/**
 * Parse esbuild error output.
 *
 * Formats:
 *   > src/index.ts:5:2: error: Unterminated string literal
 *   X [ERROR] Unterminated string literal
 *       src/index.ts:5:2:
 *   (followed by a code snippet)
 */
const esbuildLineRegex = /^[>X]?\s*(?:\[ERROR\]\s*)?(.+?):(\d+):(\d+):\s*(?:error:\s*)?(.+)$/;
const esbuildBlockRegex = /\[ERROR\]\s*(.+)/;

function parseEsbuildLine(line: string): RawErrorData | null {
  const lineMatch = line.match(esbuildLineRegex);
  if (lineMatch) {
    return {
      source: 'build',
      severity: 'error',
      type: 'EsbuildError',
      message: lineMatch[4],
      file: lineMatch[1],
      line: parseInt(lineMatch[2], 10),
      column: parseInt(lineMatch[3], 10),
    };
  }

  const blockMatch = line.match(esbuildBlockRegex);
  if (blockMatch) {
    return {
      source: 'build',
      severity: 'error',
      type: 'EsbuildError',
      message: blockMatch[1],
    };
  }

  return null;
}

/**
 * Parse build output from tsc, Vite, or esbuild.
 * Automatically detects the build tool format.
 */
export function parseBuildOutput(output: string): RawErrorData[] {
  const errors: RawErrorData[] = [];
  const lines = output.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Try tsc first (most specific patterns)
    const tscError = parseTscLine(line);
    if (tscError) {
      errors.push(tscError);
      continue;
    }

    // Try esbuild format (> prefix or [ERROR] block)
    const esbuildError = parseEsbuildLine(line);
    if (esbuildError) {
      // Look ahead for file location if the current error doesn't have one
      if (!esbuildError.file && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        const locMatch = nextLine.match(/^(.+?):(\d+):(\d+):?\s*$/);
        if (locMatch) {
          esbuildError.file = locMatch[1];
          esbuildError.line = parseInt(locMatch[2], 10);
          esbuildError.column = parseInt(locMatch[3], 10);
          i++; // skip the location line
        }
      }
      errors.push(esbuildError);
      continue;
    }

    // Try Vite format
    const viteError = parseViteLine(line);
    if (viteError) {
      errors.push(viteError);
      continue;
    }

    // Generic file:line:col pattern as fallback for build errors
    const genericMatch = line.match(viteFileErrorRegex);
    if (genericMatch) {
      errors.push({
        source: 'build',
        severity: 'error',
        type: 'BuildError',
        message: genericMatch[4],
        file: genericMatch[1],
        line: parseInt(genericMatch[2], 10),
        column: parseInt(genericMatch[3], 10),
      });
    }
  }

  // Extract tsc summary line for context: "Found N errors."
  const summaryMatch = output.match(/Found (\d+) errors?/);
  if (summaryMatch && errors.length === 0) {
    errors.push({
      source: 'build',
      severity: 'error',
      type: 'BuildError',
      message: `TypeScript compilation failed: ${summaryMatch[0]}`,
    });
  }

  return errors;
}
