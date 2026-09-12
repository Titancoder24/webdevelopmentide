import type { WorkspaceError } from './types.js';

/**
 * Generate a deduplication key from an error's identifying characteristics.
 * Errors with the same file, line, and message are considered duplicates.
 */
export function deduplicationKey(error: WorkspaceError): string {
  const parts: string[] = [
    error.source,
    error.file ?? '<no-file>',
    error.line !== undefined ? String(error.line) : '<no-line>',
    error.message,
  ];
  return parts.join('::');
}

/**
 * Merge a new error into an existing duplicate.
 * Increments occurrence count and updates last_seen.
 * If the existing error was resolved, it gets re-opened.
 */
export function mergeInto(existing: WorkspaceError, incoming: WorkspaceError): WorkspaceError {
  const now = new Date().toISOString();

  return {
    ...existing,
    occurrences: existing.occurrences + 1,
    last_seen: now,
    // Re-open if it was previously resolved
    status: 'open',
    resolved_by: null,
    // Keep the most recent stack trace and code snippet
    stack_trace: incoming.stack_trace ?? existing.stack_trace,
    code_snippet: incoming.code_snippet ?? existing.code_snippet,
    // Merge related files
    related_files: Array.from(new Set([
      ...existing.related_files,
      ...incoming.related_files,
    ])),
  };
}

/**
 * The Deduplicator tracks seen errors by their dedup key and decides
 * whether a new error is a duplicate or truly new.
 */
export class Deduplicator {
  private keyToId = new Map<string, string>();

  /**
   * Register an error's dedup key mapped to its ID.
   */
  track(error: WorkspaceError): void {
    const key = deduplicationKey(error);
    this.keyToId.set(key, error.id);
  }

  /**
   * Check if a duplicate already exists. Returns the existing error ID if so.
   */
  findDuplicate(error: WorkspaceError): string | undefined {
    const key = deduplicationKey(error);
    return this.keyToId.get(key);
  }

  /**
   * Remove tracking for a specific error ID.
   */
  remove(errorId: string): void {
    for (const [key, id] of this.keyToId.entries()) {
      if (id === errorId) {
        this.keyToId.delete(key);
        break;
      }
    }
  }

  /**
   * Clear all tracking data.
   */
  clear(): void {
    this.keyToId.clear();
  }
}
