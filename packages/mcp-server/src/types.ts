export interface DirectoryEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
}

export interface SearchOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
  include?: string[];
  exclude?: string[];
  maxResults?: number;
}

export interface SearchResult {
  file: string;
  line: number;
  column: number;
  match: string;
  context: string;
}

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  type: 'file' | 'directory' | 'symlink';
  modified: string;
  created: string;
  permissions: string;
  mimeType?: string;
}

export interface ExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ProcessInfo {
  pid: number;
  command: string;
  running: boolean;
  cpu?: number;
  memory?: number;
}

export interface PackageInfo {
  name: string;
  version: string;
  dev: boolean;
}

export interface WorkspaceError {
  id: string;
  file: string;
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  source: string;
  stack?: string;
  status: 'open' | 'resolved';
  timestamp: string;
}

export interface ResourceSnapshot {
  cpu: number;
  memory: { used: number; total: number; percentage: number };
  disk: { used: number; total: number; percentage: number };
  network: { rx: number; tx: number };
  uptime: number;
}

export interface ContextOptions {
  includeStructure?: boolean;
  includePackageJson?: boolean;
  includeTsConfig?: boolean;
  includeGitInfo?: boolean;
  maxDepth?: number;
}

export interface ScaffoldTemplate {
  name: string;
  description: string;
}

export const SCAFFOLD_TEMPLATES: Record<string, ScaffoldTemplate> = {
  react: { name: 'react', description: 'React app with Vite and TypeScript' },
  vue: { name: 'vue', description: 'Vue 3 app with Vite and TypeScript' },
  svelte: { name: 'svelte', description: 'SvelteKit app with TypeScript' },
  express: { name: 'express', description: 'Express.js API with TypeScript' },
  hono: { name: 'hono', description: 'Hono API with TypeScript' },
  expo: { name: 'expo', description: 'Expo React Native app' },
  'expo-router': { name: 'expo-router', description: 'Expo app with file-based routing' },
  'react-native': { name: 'react-native', description: 'React Native app with TypeScript' },
};
