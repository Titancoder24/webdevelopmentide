import type {
  DirectoryEntry,
  SearchOptions,
  SearchResult,
  FileInfo,
  ExecOptions,
  ExecResult,
  ProcessInfo,
  PackageInfo,
  WorkspaceError,
  ResourceSnapshot,
  ContextOptions,
} from './types.js';

/**
 * Abstract workspace interface that decouples tools from the underlying
 * runtime. Implementations can target an in-browser NodePod (WebContainer),
 * a real server-side filesystem, or a remote container.
 */
export interface Workspace {
  /** Absolute path to the workspace root. */
  readonly rootPath: string;

  // ── File operations ──────────────────────────────────────────────────
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  deleteFile(path: string, recursive?: boolean): Promise<void>;
  moveFile(source: string, destination: string): Promise<void>;
  fileExists(path: string): Promise<boolean>;

  // ── Directory operations ─────────────────────────────────────────────
  listDirectory(path: string, recursive?: boolean): Promise<DirectoryEntry[]>;
  createDirectory(path: string): Promise<void>;
  directoryTree(path: string, depth?: number): Promise<string>;

  // ── Search ───────────────────────────────────────────────────────────
  searchFiles(pattern: string, path?: string, options?: SearchOptions): Promise<SearchResult[]>;
  findFiles(pattern: string, path?: string): Promise<string[]>;
  getFileInfo(path: string): Promise<FileInfo>;

  // ── Terminal / process ───────────────────────────────────────────────
  exec(command: string, options?: ExecOptions): Promise<ExecResult>;
  execBackground(command: string, options?: ExecOptions): Promise<{ pid: number }>;
  killProcess(pid: number): Promise<void>;
  listProcesses(): Promise<ProcessInfo[]>;

  // ── npm ──────────────────────────────────────────────────────────────
  npmInstall(packages?: string[], dev?: boolean): Promise<string>;
  npmRun(script: string, args?: string[]): Promise<ExecResult>;
  listPackages(): Promise<PackageInfo[]>;

  // ── Errors ───────────────────────────────────────────────────────────
  getErrors(status?: string): Promise<WorkspaceError[]>;
  getErrorDetail(errorId: string): Promise<WorkspaceError | null>;
  resolveError(errorId: string): Promise<void>;
  clearErrors(): Promise<void>;
  getErrorSummary(): Promise<string>;

  // ── Git ──────────────────────────────────────────────────────────────
  gitStatus(): Promise<string>;
  gitCommit(message: string, files?: string[]): Promise<string>;
  gitDiff(file?: string): Promise<string>;

  // ── Preview / server ─────────────────────────────────────────────────
  getPreviewUrl(port?: number): Promise<string>;
  getServerLogs(lines?: number): Promise<string>;

  // ── Resources ────────────────────────────────────────────────────────
  getResourceUsage(): Promise<ResourceSnapshot>;

  // ── Context ──────────────────────────────────────────────────────────
  getCodebaseContext(options?: ContextOptions): Promise<string>;
  getFileContext(path: string, includeImports?: boolean): Promise<string>;
  getProjectSummary(): Promise<string>;
}
