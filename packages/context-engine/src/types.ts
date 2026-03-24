export interface ContextOptions {
  include?: string[];
  exclude?: string[];
  format?: 'xml' | 'markdown' | 'plain';
  compress?: boolean;
  max_tokens?: number;
}

export interface FileEntry {
  path: string;
  content: string;
  language: string;
  tokens: number;
}

export interface ProjectInfo {
  name: string;
  framework: string;
  languages: Record<string, number>;
  totalFiles: number;
  totalTokens: number;
  entryPoints: Record<string, string>;
  envVars: string[];
}

export interface ContextResult {
  output: string;
  tokenCount: number;
  fileCount: number;
}

/** Abstracted filesystem interface -- works with NodePod VFS or real FS */
export interface FileSystem {
  readFile(path: string): Promise<string>;
  readdir(path: string, recursive?: boolean): Promise<string[]>;
  stat(path: string): Promise<{ size: number; mtime: Date; isDirectory: boolean }>;
  exists(path: string): Promise<boolean>;
}

export interface ChunkResult {
  included: FileEntry[];
  excluded: string[];
  totalTokens: number;
}
