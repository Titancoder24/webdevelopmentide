import type { WorkspaceError, ErrorFilter, ErrorSummary, ErrorSeverity, ErrorSource } from './types.js';
import { Deduplicator, mergeInto } from './deduplicator.js';
import { normalize } from './normalizer.js';
import type { RawErrorData } from './types.js';

const RESOLVED_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class ErrorStore {
  private errors = new Map<string, WorkspaceError>();
  private deduplicator = new Deduplicator();

  /**
   * Add a normalized WorkspaceError to the store.
   * Handles deduplication: if a matching error exists, merges into it.
   * Returns the resulting error (new or merged) and whether it was a duplicate.
   */
  add(error: WorkspaceError): { error: WorkspaceError; isDuplicate: boolean } {
    const existingId = this.deduplicator.findDuplicate(error);

    if (existingId) {
      const existing = this.errors.get(existingId);
      if (existing) {
        const merged = mergeInto(existing, error);
        this.errors.set(existingId, merged);
        return { error: merged, isDuplicate: true };
      }
    }

    // New error
    this.errors.set(error.id, error);
    this.deduplicator.track(error);
    return { error, isDuplicate: false };
  }

  /**
   * Get a single error by ID.
   */
  get(id: string): WorkspaceError | undefined {
    return this.errors.get(id);
  }

  /**
   * Get all errors, optionally sorted by timestamp descending.
   */
  getAll(): WorkspaceError[] {
    return Array.from(this.errors.values()).sort(
      (a, b) => new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime()
    );
  }

  /**
   * Get errors matching a filter.
   */
  getByFilter(filter: ErrorFilter): WorkspaceError[] {
    let results = this.getAll();

    if (filter.status && filter.status !== 'all') {
      results = results.filter((e) => e.status === filter.status);
    }

    if (filter.severity) {
      results = results.filter((e) => e.severity === filter.severity);
    }

    if (filter.since) {
      const sinceTime = new Date(filter.since).getTime();
      results = results.filter((e) => new Date(e.last_seen).getTime() >= sinceTime);
    }

    if (filter.file) {
      const filePath = filter.file;
      results = results.filter(
        (e) =>
          e.file === filePath ||
          e.related_files.includes(filePath)
      );
    }

    return results;
  }

  /**
   * Mark an error as resolved.
   */
  resolve(id: string, resolvedBy?: string): boolean {
    const error = this.errors.get(id);
    if (!error) return false;

    error.status = 'resolved';
    error.resolved_by = resolvedBy ?? null;
    return true;
  }

  /**
   * Resolve all open errors associated with a given file.
   * Called when a file is edited, indicating the user may have fixed the errors.
   */
  resolveByFile(filePath: string, resolvedBy: string = 'file-edit'): WorkspaceError[] {
    const resolved: WorkspaceError[] = [];

    for (const error of this.errors.values()) {
      if (error.status === 'open' && error.file === filePath) {
        error.status = 'resolved';
        error.resolved_by = resolvedBy;
        resolved.push(error);
      }
    }

    return resolved;
  }

  /**
   * Notify that a file has changed. Auto-resolves open errors for that file.
   * Returns the list of errors that were resolved.
   */
  notifyFileChanged(filePath: string): WorkspaceError[] {
    return this.resolveByFile(filePath, 'file-edit');
  }

  /**
   * Remove resolved errors older than 24 hours.
   */
  clearResolved(): number {
    const now = Date.now();
    let removed = 0;

    for (const [id, error] of this.errors.entries()) {
      if (error.status === 'resolved') {
        const lastSeenTime = new Date(error.last_seen).getTime();
        if (now - lastSeenTime > RESOLVED_TTL_MS) {
          this.errors.delete(id);
          this.deduplicator.remove(id);
          removed++;
        }
      }
    }

    return removed;
  }

  /**
   * Get a summary of the current error state.
   */
  getSummary(): ErrorSummary {
    const all = this.getAll();
    const open = all.filter((e) => e.status === 'open');
    const resolved = all.filter((e) => e.status === 'resolved');

    const by_severity: Record<ErrorSeverity, number> = {
      error: 0,
      warning: 0,
      info: 0,
    };

    const by_source: Partial<Record<ErrorSource, number>> = {};

    for (const err of open) {
      by_severity[err.severity]++;
      by_source[err.source] = (by_source[err.source] ?? 0) + 1;
    }

    return {
      total: all.length,
      open: open.length,
      resolved: resolved.length,
      by_severity,
      by_source,
      most_recent: all[0],
    };
  }

  /**
   * Get the total number of errors in the store.
   */
  get size(): number {
    return this.errors.size;
  }
}
