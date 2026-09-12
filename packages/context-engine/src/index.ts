/**
 * @llm-ide/context-engine
 *
 * Repomix-inspired codebase context engine that gives LLMs deep project
 * understanding.  Reads a project through an abstracted FileSystem interface
 * (so it works equally well with a real FS or a NodePod virtual FS), detects
 * the project's framework / languages / entry-points, and packs the codebase
 * into an XML / Markdown / Plain text representation optimised for LLM
 * consumption.
 */

export type {
  ContextOptions,
  FileEntry,
  ProjectInfo,
  ContextResult,
  FileSystem,
  ChunkResult,
} from './types.js';

export { estimateTokens, estimateTokensBatch } from './token-counter.js';
export { detectProject, languageForFile } from './detector.js';
export { compressCode } from './compressor.js';
export { chunkFiles } from './chunker.js';
export type { ChunkOptions } from './chunker.js';
export { packFiles } from './packer.js';

import type { ContextOptions, ContextResult, FileEntry, FileSystem, ProjectInfo } from './types.js';
import { detectProject, languageForFile } from './detector.js';
import { estimateTokens } from './token-counter.js';
import { compressCode } from './compressor.js';
import { chunkFiles } from './chunker.js';
import { packFiles } from './packer.js';

// ---------------------------------------------------------------------------
// ContextEngine — the main entry point
// ---------------------------------------------------------------------------

export class ContextEngine {
  private fs: FileSystem;
  private root: string;

  /**
   * @param fs   Abstracted filesystem (real FS adapter or NodePod VFS)
   * @param root Absolute path to the project root directory
   */
  constructor(fs: FileSystem, root: string) {
    this.fs = fs;
    this.root = root.replace(/\/+$/, ''); // strip trailing slash
  }

  // -----------------------------------------------------------------------
  // pack() — generate full project context
  // -----------------------------------------------------------------------

  /**
   * Pack the entire project (or a subset) into a formatted context string
   * suitable for feeding to an LLM.
   *
   * @param options Controls include/exclude globs, output format, compression,
   *                and token budget.
   * @returns       The formatted output string along with token / file counts.
   */
  async pack(options: ContextOptions = {}): Promise<ContextResult> {
    const projectInfo = await this.getProjectSummary();

    return packFiles(this.fs, this.root, {
      options,
      projectInfo,
    });
  }

  // -----------------------------------------------------------------------
  // getFileContext() — context for a single file
  // -----------------------------------------------------------------------

  /**
   * Get the context (content + metadata) for a single file.
   *
   * @param filePath Path relative to the project root.
   * @param compress If true, compress the source code to signatures only.
   * @returns        A FileEntry with content, language, and token count.
   */
  async getFileContext(filePath: string, compress = false): Promise<FileEntry> {
    const fullPath = `${this.root}/${filePath}`;
    let content = await this.fs.readFile(fullPath);
    const language = languageForFile(filePath);

    if (compress) {
      content = compressCode(content, language);
    }

    const tokens = estimateTokens(content);

    return { path: filePath, content, language, tokens };
  }

  // -----------------------------------------------------------------------
  // getProjectSummary() — detect project info
  // -----------------------------------------------------------------------

  /**
   * Detect and return a summary of the project: name, framework, languages,
   * entry points, environment variables, etc.
   */
  async getProjectSummary(): Promise<ProjectInfo> {
    return detectProject(this.fs, this.root);
  }

  // -----------------------------------------------------------------------
  // chunkForBudget() — smart-chunked packing with a token budget
  // -----------------------------------------------------------------------

  /**
   * Pack files using the smart chunker that prioritises config / entry-point
   * files and respects a token budget.
   *
   * @param options  Controls include/exclude globs, format, compression, and
   *                 max_tokens budget.
   * @returns        The chunked context result plus lists of included / excluded
   *                 files.
   */
  async chunkForBudget(options: ContextOptions = {}): Promise<{
    result: ContextResult;
    includedFiles: string[];
    excludedFiles: string[];
  }> {
    const maxTokens = options.max_tokens ?? 100_000;
    const compress = options.compress ?? false;

    // Enumerate all files
    let allFiles: string[] = [];
    try {
      allFiles = await this.fs.readdir(this.root, true);
    } catch {
      return {
        result: { output: '', tokenCount: 0, fileCount: 0 },
        includedFiles: [],
        excludedFiles: [],
      };
    }

    // Apply include/exclude filters
    let filtered = allFiles;
    if (options.include && options.include.length > 0) {
      filtered = filtered.filter((f) =>
        options.include!.some((pattern) => matchesSimpleGlob(f, pattern)),
      );
    }
    if (options.exclude && options.exclude.length > 0) {
      filtered = filtered.filter(
        (f) => !options.exclude!.some((pattern) => matchesSimpleGlob(f, pattern)),
      );
    }

    // Use chunker to prioritise and budget
    const chunkResult = await chunkFiles(this.fs, this.root, filtered, {
      maxTokens,
      compress,
    });

    // Build output using the packer's format logic
    const projectInfo = await this.getProjectSummary();
    const updatedInfo: ProjectInfo = {
      ...projectInfo,
      totalFiles: chunkResult.included.length,
      totalTokens: chunkResult.totalTokens,
    };

    const format = options.format ?? 'xml';
    // Re-use packFiles but pass already-read files by creating a synthetic FS
    // that returns pre-loaded content. This avoids re-reading files.
    const result = await packFiles(
      createPreloadedFS(this.fs, this.root, chunkResult.included),
      this.root,
      {
        options: {
          ...options,
          // Files are already chunked/compressed; disable further compression
          // and token limits in the packer itself
          compress: false,
          max_tokens: 0,
          // Only include files that the chunker selected
          include: chunkResult.included.map((f) => f.path),
        },
        projectInfo: updatedInfo,
      },
    );

    return {
      result,
      includedFiles: chunkResult.included.map((f) => f.path),
      excludedFiles: chunkResult.excluded,
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Simple glob matching for include/exclude patterns. */
function matchesSimpleGlob(filePath: string, pattern: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  let regexStr = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/{{GLOBSTAR}}/g, '.*');
  regexStr = '^' + regexStr + '$';
  try {
    return new RegExp(regexStr).test(normalized);
  } catch {
    return false;
  }
}

/**
 * Create a FileSystem wrapper that returns pre-loaded content for files that
 * have already been read by the chunker, falling back to the real FS for
 * anything else (e.g. .gitignore).
 */
function createPreloadedFS(
  realFS: FileSystem,
  root: string,
  entries: FileEntry[],
): FileSystem {
  const cache = new Map<string, string>();
  for (const entry of entries) {
    cache.set(`${root}/${entry.path}`, entry.content);
  }

  return {
    readFile: async (path: string) => {
      if (cache.has(path)) return cache.get(path)!;
      return realFS.readFile(path);
    },
    readdir: (path, recursive) => realFS.readdir(path, recursive),
    stat: (path) => realFS.stat(path),
    exists: (path) => realFS.exists(path),
  };
}

export default ContextEngine;
