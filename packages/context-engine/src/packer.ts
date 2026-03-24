import type { FileSystem, FileEntry, ContextOptions, ContextResult, ProjectInfo } from './types.js';
import { estimateTokens } from './token-counter.js';
import { languageForFile } from './detector.js';
import { compressCode } from './compressor.js';

// ---------------------------------------------------------------------------
// .gitignore parsing
// ---------------------------------------------------------------------------

/** Parse a .gitignore file into a list of patterns. */
function parseGitignore(content: string): string[] {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

/**
 * Check whether a file path should be ignored based on gitignore-style patterns.
 * Supports basic gitignore semantics: directory patterns (ending with /),
 * leading slash (root-relative), wildcards, and negation (leading !).
 */
function isIgnored(filePath: string, patterns: string[]): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  let ignored = false;

  for (const raw of patterns) {
    let pattern = raw;
    const negated = pattern.startsWith('!');
    if (negated) pattern = pattern.slice(1);

    // Remove trailing slash (directory indicator) for matching purposes
    const dirOnly = pattern.endsWith('/');
    if (dirOnly) pattern = pattern.slice(0, -1);

    // Build a regex from the glob pattern
    let regexStr = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '{{GLOBSTAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]')
      .replace(/{{GLOBSTAR}}/g, '.*');

    // If pattern starts with /, match from root only; otherwise match anywhere
    if (regexStr.startsWith('/')) {
      regexStr = '^' + regexStr.slice(1);
    } else {
      regexStr = '(^|/)' + regexStr;
    }

    regexStr += '(/.*)?$';

    try {
      const re = new RegExp(regexStr);
      if (re.test(normalized)) {
        ignored = !negated;
      }
    } catch {
      // Invalid pattern -- skip
    }
  }

  return ignored;
}

// ---------------------------------------------------------------------------
// Default exclude patterns (always ignored)
// ---------------------------------------------------------------------------

const DEFAULT_EXCLUDES = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.svelte-kit',
  '.expo',
  'coverage',
  '.turbo',
  '.vercel',
  '.output',
  '__pycache__',
  '.DS_Store',
  'Thumbs.db',
  '*.lock',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lockb',
  '*.map',
  '*.min.js',
  '*.min.css',
  '*.chunk.js',
  '*.bundle.js',
];

// ---------------------------------------------------------------------------
// Glob matching for include/exclude options
// ---------------------------------------------------------------------------

function matchesGlob(filePath: string, pattern: string): boolean {
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

function matchesAnyGlob(filePath: string, patterns: string[]): boolean {
  return patterns.some((p) => matchesGlob(filePath, p));
}

// ---------------------------------------------------------------------------
// Binary file detection
// ---------------------------------------------------------------------------

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.bmp', '.webp', '.avif', '.svg',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.mp3', '.mp4', '.wav', '.ogg', '.webm', '.avi',
  '.zip', '.gz', '.tar', '.bz2', '.7z', '.rar',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.pptx',
  '.exe', '.dll', '.so', '.dylib', '.wasm',
  '.sqlite', '.db',
]);

function isBinaryFile(filePath: string): boolean {
  const ext = (filePath.match(/(\.[^./]+)$/) ?? ['', ''])[1]!.toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

// ---------------------------------------------------------------------------
// Directory tree generation
// ---------------------------------------------------------------------------

function buildDirectoryTree(files: string[]): string {
  const tree: Record<string, any> = {};

  for (const file of files) {
    const parts = file.split('/');
    let current = tree;
    for (const part of parts) {
      if (!current[part]) current[part] = {};
      current = current[part];
    }
  }

  function render(node: Record<string, any>, prefix: string): string[] {
    const entries = Object.keys(node).sort((a, b) => {
      // Directories (non-empty nodes) first, then files
      const aIsDir = Object.keys(node[a]).length > 0;
      const bIsDir = Object.keys(node[b]).length > 0;
      if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
      return a.localeCompare(b);
    });

    const lines: string[] = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]!;
      const isLast = i === entries.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      const childPrefix = isLast ? '    ' : '│   ';
      const children = Object.keys(node[entry]);

      if (children.length > 0) {
        lines.push(`${prefix}${connector}${entry}/`);
        lines.push(...render(node[entry], prefix + childPrefix));
      } else {
        lines.push(`${prefix}${connector}${entry}`);
      }
    }
    return lines;
  }

  return render(tree, '').join('\n');
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatXml(
  projectInfo: ProjectInfo,
  files: FileEntry[],
  tree: string,
): string {
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<repository>');
  lines.push('<repository_summary>');
  lines.push(`<project_name>${escapeXml(projectInfo.name)}</project_name>`);
  lines.push(`<framework>${escapeXml(projectInfo.framework)}</framework>`);
  lines.push('<languages>');
  for (const [lang, pct] of Object.entries(projectInfo.languages)) {
    lines.push(`  <language name="${escapeXml(lang)}" percentage="${pct}" />`);
  }
  lines.push('</languages>');
  lines.push(`<total_files>${projectInfo.totalFiles}</total_files>`);
  lines.push(`<total_tokens>${projectInfo.totalTokens}</total_tokens>`);

  if (Object.keys(projectInfo.entryPoints).length > 0) {
    lines.push('<entry_points>');
    for (const [name, cmd] of Object.entries(projectInfo.entryPoints)) {
      lines.push(`  <script name="${escapeXml(name)}">${escapeXml(String(cmd))}</script>`);
    }
    lines.push('</entry_points>');
  }

  if (projectInfo.envVars.length > 0) {
    lines.push('<environment_variables>');
    for (const v of projectInfo.envVars) {
      lines.push(`  <variable>${escapeXml(v)}</variable>`);
    }
    lines.push('</environment_variables>');
  }

  lines.push('</repository_summary>');

  lines.push('<directory_tree>');
  lines.push(escapeXml(tree));
  lines.push('</directory_tree>');

  lines.push('<repository_files>');
  for (const file of files) {
    lines.push(`<file path="${escapeXml(file.path)}" language="${escapeXml(file.language)}" tokens="${file.tokens}">`);
    lines.push('<![CDATA[');
    lines.push(file.content);
    lines.push(']]>');
    lines.push('</file>');
  }
  lines.push('</repository_files>');

  lines.push('</repository>');

  return lines.join('\n');
}

function formatMarkdown(
  projectInfo: ProjectInfo,
  files: FileEntry[],
  tree: string,
): string {
  const lines: string[] = [];

  lines.push(`# ${projectInfo.name}`);
  lines.push('');
  lines.push(`**Framework:** ${projectInfo.framework}`);
  lines.push(`**Files:** ${projectInfo.totalFiles} | **Tokens:** ${projectInfo.totalTokens}`);
  lines.push('');

  lines.push('## Languages');
  for (const [lang, pct] of Object.entries(projectInfo.languages)) {
    lines.push(`- ${lang}: ${pct}%`);
  }
  lines.push('');

  if (Object.keys(projectInfo.entryPoints).length > 0) {
    lines.push('## Scripts / Entry Points');
    for (const [name, cmd] of Object.entries(projectInfo.entryPoints)) {
      lines.push(`- **${name}**: \`${cmd}\``);
    }
    lines.push('');
  }

  if (projectInfo.envVars.length > 0) {
    lines.push('## Environment Variables');
    for (const v of projectInfo.envVars) {
      lines.push(`- \`${v}\``);
    }
    lines.push('');
  }

  lines.push('## Directory Structure');
  lines.push('```');
  lines.push(tree);
  lines.push('```');
  lines.push('');

  lines.push('## Files');
  lines.push('');
  for (const file of files) {
    const langTag = file.language.toLowerCase();
    lines.push(`### ${file.path}`);
    lines.push(`\`\`\`${langTag}`);
    lines.push(file.content);
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}

function formatPlain(
  projectInfo: ProjectInfo,
  files: FileEntry[],
  tree: string,
): string {
  const lines: string[] = [];

  lines.push(`Project: ${projectInfo.name}`);
  lines.push(`Framework: ${projectInfo.framework}`);
  lines.push(`Files: ${projectInfo.totalFiles} | Tokens: ${projectInfo.totalTokens}`);
  lines.push('');
  lines.push('Languages:');
  for (const [lang, pct] of Object.entries(projectInfo.languages)) {
    lines.push(`  ${lang}: ${pct}%`);
  }
  lines.push('');

  lines.push('Directory Structure:');
  lines.push(tree);
  lines.push('');

  lines.push('='.repeat(72));
  lines.push('Files:');
  lines.push('='.repeat(72));
  lines.push('');

  for (const file of files) {
    lines.push(`--- ${file.path} (${file.language}, ${file.tokens} tokens) ---`);
    lines.push(file.content);
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// XML escaping
// ---------------------------------------------------------------------------

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface PackOptions {
  options: ContextOptions;
  projectInfo: ProjectInfo;
}

/**
 * Pack project files into a formatted context string (XML, Markdown, or Plain).
 *
 * Steps:
 *   1. Enumerate files via the provided FileSystem
 *   2. Apply .gitignore, default excludes, and user include/exclude globs
 *   3. Read file contents (optionally compressing them)
 *   4. Build directory tree
 *   5. Format output in the requested format
 */
export async function packFiles(
  fs: FileSystem,
  root: string,
  packOpts: PackOptions,
): Promise<ContextResult> {
  const { options, projectInfo } = packOpts;
  const format = options.format ?? 'xml';
  const compress = options.compress ?? false;

  // Read .gitignore if present
  let gitignorePatterns: string[] = [];
  try {
    const gitignoreContent = await fs.readFile(`${root}/.gitignore`);
    gitignorePatterns = parseGitignore(gitignoreContent);
  } catch {
    // No .gitignore
  }

  // Enumerate all files
  let allFiles: string[] = [];
  try {
    allFiles = await fs.readdir(root, true);
  } catch {
    return { output: '', tokenCount: 0, fileCount: 0 };
  }

  // Filter files
  const filtered = allFiles.filter((filePath) => {
    // Skip binary files
    if (isBinaryFile(filePath)) return false;

    // Apply default excludes
    if (isIgnored(filePath, DEFAULT_EXCLUDES)) return false;

    // Apply .gitignore
    if (isIgnored(filePath, gitignorePatterns)) return false;

    // Apply user-specified exclude patterns
    if (options.exclude && options.exclude.length > 0) {
      if (matchesAnyGlob(filePath, options.exclude)) return false;
    }

    // Apply user-specified include patterns (if set, only matching files pass)
    if (options.include && options.include.length > 0) {
      if (!matchesAnyGlob(filePath, options.include)) return false;
    }

    return true;
  });

  // Read file contents and build FileEntry objects
  const fileEntries: FileEntry[] = [];
  let totalTokens = 0;
  const maxTokens = options.max_tokens ?? 0;

  for (const filePath of filtered) {
    const fullPath = `${root}/${filePath}`;

    let content: string;
    try {
      content = await fs.readFile(fullPath);
    } catch {
      continue;
    }

    const language = languageForFile(filePath);

    if (compress) {
      content = compressCode(content, language);
    }

    const tokens = estimateTokens(content);

    // Respect token budget
    if (maxTokens > 0 && totalTokens + tokens > maxTokens && fileEntries.length > 0) {
      continue;
    }

    fileEntries.push({ path: filePath, content, language, tokens });
    totalTokens += tokens;
  }

  // Update project info with actual totals
  const updatedInfo: ProjectInfo = {
    ...projectInfo,
    totalFiles: fileEntries.length,
    totalTokens,
  };

  // Build directory tree
  const tree = buildDirectoryTree(fileEntries.map((f) => f.path));

  // Format output
  let output: string;
  switch (format) {
    case 'markdown':
      output = formatMarkdown(updatedInfo, fileEntries, tree);
      break;
    case 'plain':
      output = formatPlain(updatedInfo, fileEntries, tree);
      break;
    case 'xml':
    default:
      output = formatXml(updatedInfo, fileEntries, tree);
      break;
  }

  const tokenCount = estimateTokens(output);

  return { output, tokenCount, fileCount: fileEntries.length };
}

// Re-export helpers for use in ContextEngine
export { buildDirectoryTree, isIgnored, parseGitignore, matchesAnyGlob, isBinaryFile, DEFAULT_EXCLUDES };
