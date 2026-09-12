import type { RawErrorData } from '../types.js';

/**
 * Parse Node.js uncaught exceptions and unhandled promise rejections
 * into raw error data.
 *
 * Handles:
 * - Uncaught exceptions with stack traces
 * - Unhandled promise rejections
 * - process.on('uncaughtException') and process.on('unhandledRejection') output
 * - Browser-style runtime errors (window.onerror output)
 */

// Matches the first line of a standard JS error: "ErrorType: message"
const errorTypeRegex = /^(\w+Error):\s*(.+)/;

// Matches Node.js "internal/process/promises.js" unhandled rejection warning
const unhandledRejectionRegex =
  /UnhandledPromiseRejectionWarning:\s*(?:(\w+Error):\s*)?(.+)/;

// Matches Node.js deprecation warning format for unhandled rejections
const rejectionDeprecationRegex =
  /\[UnhandledPromiseRejection: This error originated either by throwing inside of an async function without a catch block/;

// Matches "Uncaught (in promise)" from browser consoles or similar output
const uncaughtInPromiseRegex = /Uncaught \(in promise\)\s*(?:(\w+Error):\s*)?(.+)/;

// Matches fatal error output from Node.js
const fatalErrorRegex =
  /FATAL ERROR:\s*(.+)/;

// Matches Node.js "throw err;" pattern with caret indicator
const throwLineRegex = /^\s*throw\s+/;

/**
 * Extract a stack trace from lines starting after the error line.
 * Collects consecutive lines that look like stack frames.
 */
function extractStackTrace(lines: string[], startIndex: number): string | undefined {
  const frames: string[] = [];
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s+at\s+/.test(line)) {
      frames.push(line);
    } else if (frames.length > 0) {
      // Stop collecting once we leave the stack trace region
      break;
    }
  }
  return frames.length > 0 ? frames.join('\n') : undefined;
}

/**
 * Parse a runtime error string (typically from uncaught exception or
 * unhandled rejection handlers) into structured error data.
 */
export function parseRuntimeError(output: string): RawErrorData[] {
  const errors: RawErrorData[] = [];
  const lines = output.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Skip "throw err;" marker lines and caret lines
    if (throwLineRegex.test(line) || line === '^') continue;

    // Unhandled promise rejection warning (Node.js format)
    const rejectionMatch = line.match(unhandledRejectionRegex);
    if (rejectionMatch) {
      const errorType = rejectionMatch[1] ?? 'UnhandledRejection';
      const message = rejectionMatch[2];
      const stack = extractStackTrace(lines, i + 1);

      errors.push({
        source: 'runtime',
        severity: 'error',
        type: errorType,
        message,
        stack_trace: stack ? `${line}\n${stack}` : undefined,
      });

      // Skip stack trace lines
      if (stack) {
        i += stack.split('\n').length;
      }
      continue;
    }

    // "Uncaught (in promise)" from browser-like environments
    const uncaughtPromiseMatch = line.match(uncaughtInPromiseRegex);
    if (uncaughtPromiseMatch) {
      const errorType = uncaughtPromiseMatch[1] ?? 'UnhandledRejection';
      const message = uncaughtPromiseMatch[2];
      const stack = extractStackTrace(lines, i + 1);

      errors.push({
        source: 'runtime',
        severity: 'error',
        type: errorType,
        message,
        stack_trace: stack ? `${line}\n${stack}` : undefined,
      });

      if (stack) {
        i += stack.split('\n').length;
      }
      continue;
    }

    // Skip deprecation notice lines about unhandled rejections
    if (rejectionDeprecationRegex.test(line)) continue;

    // FATAL ERROR (V8 heap out of memory, etc.)
    const fatalMatch = line.match(fatalErrorRegex);
    if (fatalMatch) {
      // Collect remaining lines as context
      const context: string[] = [];
      for (let j = i + 1; j < lines.length && j < i + 20; j++) {
        if (lines[j].trim()) context.push(lines[j]);
      }

      errors.push({
        source: 'runtime',
        severity: 'error',
        type: 'FatalError',
        message: fatalMatch[1],
        stack_trace: context.length > 0 ? context.join('\n') : undefined,
      });
      break; // Fatal errors end everything
    }

    // Standard JS error: "TypeError: Cannot read properties of undefined"
    const errorMatch = line.match(errorTypeRegex);
    if (errorMatch) {
      const errorType = errorMatch[1];
      const message = errorMatch[2];
      const stack = extractStackTrace(lines, i + 1);

      errors.push({
        source: 'runtime',
        severity: 'error',
        type: errorType,
        message,
        stack_trace: stack ? `${line}\n${stack}` : undefined,
      });

      if (stack) {
        i += stack.split('\n').length;
      }
      continue;
    }
  }

  return errors;
}

/**
 * Parse an Error object directly (for use when catching errors programmatically
 * rather than parsing text output).
 */
export function parseErrorObject(error: Error, isUnhandledRejection = false): RawErrorData {
  const type = error.constructor?.name ?? error.name ?? 'Error';
  return {
    source: 'runtime',
    severity: 'error',
    type: isUnhandledRejection ? `UnhandledRejection<${type}>` : type,
    message: error.message,
    stack_trace: error.stack,
  };
}
