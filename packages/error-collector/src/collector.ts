import type {
  WorkspaceError,
  ErrorFilter,
  ErrorSummary,
  RawErrorData,
} from './types.js';
import { normalize } from './normalizer.js';
import { ErrorStore } from './store.js';
import { parseTerminalOutput } from './parsers/terminal.js';
import { parseBuildOutput } from './parsers/build.js';
import { parseESLintJson } from './parsers/lint.js';
import { parseRuntimeError, parseErrorObject } from './parsers/runtime.js';

// ── Simple EventEmitter ──────────────────────────────────────────────

type EventMap = {
  'error:added': WorkspaceError;
  'error:resolved': WorkspaceError;
  'error:updated': WorkspaceError;
  'errors:cleared': number;
};

type EventName = keyof EventMap;
type Listener<T> = (payload: T) => void;

class SimpleEmitter {
  private listeners = new Map<string, Set<Function>>();

  on<K extends EventName>(event: K, listener: Listener<EventMap[K]>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off<K extends EventName>(event: K, listener: Listener<EventMap[K]>): void {
    this.listeners.get(event)?.delete(listener);
  }

  protected emit<K extends EventName>(event: K, payload: EventMap[K]): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const fn of set) {
        try {
          fn(payload);
        } catch {
          // Swallow listener errors to avoid cascading failures
        }
      }
    }
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}

// ── ErrorCollector ───────────────────────────────────────────────────

export class ErrorCollector extends SimpleEmitter {
  private store = new ErrorStore();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options?: { autoCleanupInterval?: number }) {
    super();

    // Periodically purge stale resolved errors (default: every hour)
    const interval = options?.autoCleanupInterval ?? 60 * 60 * 1000;
    if (interval > 0) {
      this.cleanupTimer = setInterval(() => {
        const count = this.store.clearResolved();
        if (count > 0) {
          this.emit('errors:cleared', count);
        }
      }, interval);

      // Allow the process to exit even with the timer running (Node.js)
      if (this.cleanupTimer != null && typeof (this.cleanupTimer as any).unref === 'function') {
        (this.cleanupTimer as any).unref();
      }
    }
  }

  // ── Raw ingestion ────────────────────────────────────────────────

  /**
   * Ingest a raw error data object directly.
   * Normalizes, deduplicates, stores, and emits events.
   */
  ingestRaw(raw: RawErrorData): WorkspaceError {
    const normalized = normalize(raw);
    const { error, isDuplicate } = this.store.add(normalized);

    if (isDuplicate) {
      this.emit('error:updated', error);
    } else {
      this.emit('error:added', error);
    }

    return error;
  }

  /**
   * Ingest multiple raw error data objects.
   */
  ingestRawBatch(raws: RawErrorData[]): WorkspaceError[] {
    return raws.map((raw) => this.ingestRaw(raw));
  }

  // ── Source-specific ingestion ────────────────────────────────────

  /**
   * Ingest terminal stderr output and optional exit code.
   * Parses the output and creates structured errors.
   */
  ingestTerminal(stderr: string, exitCode?: number): WorkspaceError[] {
    const raws = parseTerminalOutput(stderr, exitCode);
    return this.ingestRawBatch(raws);
  }

  /**
   * Ingest build tool output (tsc, Vite, esbuild).
   */
  ingestBuild(output: string): WorkspaceError[] {
    const raws = parseBuildOutput(output);
    return this.ingestRawBatch(raws);
  }

  /**
   * Ingest ESLint output (JSON or text format).
   */
  ingestLint(output: string): WorkspaceError[] {
    const raws = parseESLintJson(output);
    return this.ingestRawBatch(raws);
  }

  /**
   * Ingest runtime error output (uncaught exceptions, unhandled rejections).
   */
  ingestRuntime(output: string): WorkspaceError[] {
    const raws = parseRuntimeError(output);
    return this.ingestRawBatch(raws);
  }

  /**
   * Ingest an actual Error object (for programmatic use).
   */
  ingestError(error: Error, isUnhandledRejection = false): WorkspaceError {
    const raw = parseErrorObject(error, isUnhandledRejection);
    return this.ingestRaw(raw);
  }

  // ── Query methods ────────────────────────────────────────────────

  /**
   * Get a single error by ID.
   */
  get(id: string): WorkspaceError | undefined {
    return this.store.get(id);
  }

  /**
   * Get all errors sorted by most recent.
   */
  getAll(): WorkspaceError[] {
    return this.store.getAll();
  }

  /**
   * Get errors matching a filter.
   */
  getByFilter(filter: ErrorFilter): WorkspaceError[] {
    return this.store.getByFilter(filter);
  }

  /**
   * Get a summary of the current error state.
   */
  getSummary(): ErrorSummary {
    return this.store.getSummary();
  }

  // ── Resolution methods ───────────────────────────────────────────

  /**
   * Mark an error as resolved.
   */
  resolve(id: string, resolvedBy?: string): boolean {
    const success = this.store.resolve(id, resolvedBy);
    if (success) {
      const error = this.store.get(id);
      if (error) {
        this.emit('error:resolved', error);
      }
    }
    return success;
  }

  /**
   * Resolve all open errors for a specific file.
   */
  resolveByFile(filePath: string, resolvedBy?: string): WorkspaceError[] {
    const resolved = this.store.resolveByFile(filePath, resolvedBy);
    for (const error of resolved) {
      this.emit('error:resolved', error);
    }
    return resolved;
  }

  /**
   * Notify that a file has been changed/edited.
   * Auto-resolves open errors for that file.
   */
  notifyFileChanged(filePath: string): WorkspaceError[] {
    const resolved = this.store.notifyFileChanged(filePath);
    for (const error of resolved) {
      this.emit('error:resolved', error);
    }
    return resolved;
  }

  /**
   * Remove resolved errors older than 24 hours.
   */
  clearResolved(): number {
    const count = this.store.clearResolved();
    if (count > 0) {
      this.emit('errors:cleared', count);
    }
    return count;
  }

  // ── Lifecycle ────────────────────────────────────────────────────

  /**
   * Clean up timers and listeners. Call when disposing the collector.
   */
  dispose(): void {
    if (this.cleanupTimer !== null) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.removeAllListeners();
  }

  /**
   * Total number of tracked errors.
   */
  get size(): number {
    return this.store.size;
  }
}
