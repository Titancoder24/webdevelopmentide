import type { FileSystem, FileEntry, ChunkResult } from './types.js';
import { estimateTokens } from './token-counter.js';
import { languageForFile } from './detector.js';
import { compressCode } from './compressor.js';

// ---------------------------------------------------------------------------
// Priority tiers
// ---------------------------------------------------------------------------

/** Files that should always be packed first (project context). */
const CONFIG_PATTERNS = [
  'package.json',
  'tsconfig.json',
  'tsconfig.*.json',
  'vite.config.ts',
  'vite.config.js',
  'next.config.ts',
  'next.config.js',
  'next.config.mjs',
  'remix.config.js',
  'svelte.config.js',
  'astro.config.mjs',
  'tailwind.config.ts',
  'tailwind.config.js',
  'postcss.config.js',
  'drizzle.config.ts',
  'prisma/schema.prisma',
  '.env.example',
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
];

/** Entry point file patterns (high priority). */
const ENTRY_PATTERNS = [
  'src/index.ts',
  'src/index.tsx',
  'src/main.ts',
  'src/main.tsx',
  'src/app.ts',
  'src/app.tsx',
  'src/App.tsx',
  'src/App.vue',
  'src/App.svelte',
  'app/layout.tsx',
  'app/page.tsx',
  'pages/index.tsx',
  'pages/_app.tsx',
  'server/index.ts',
  'index.ts',
  'index.js',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function matchesAny(filePath: string, patterns: string[]): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return patterns.some((pattern) => {
    // Support simple wildcard matching
    if (pattern.includes('*')) {
      const re = new RegExp(
        '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$',
      );
      return re.test(normalized) || re.test(normalized.split('/').pop() ?? '');
    }
    return normalized === pattern || normalized.endsWith('/' + pattern);
  });
}

interface ScoredFile {
  path: string;
  priority: number; // lower = more important
  mtime: Date;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ChunkOptions {
  maxTokens: number;
  compress?: boolean;
}

/**
 * Smart-chunk a list of file paths into a token-budgeted set of FileEntry
 * objects.
 *
 * Strategy:
 *   1. Config files and entry points first (priority 0 & 1)
 *   2. Recently modified source files next (priority 2, sorted by mtime desc)
 *   3. Everything else (priority 3)
 *   4. Stop adding when maxTokens is reached
 */
export async function chunkFiles(
  fs: FileSystem,
  root: string,
  files: string[],
  options: ChunkOptions,
): Promise<ChunkResult> {
  const { maxTokens, compress = false } = options;

  // Score every file
  const scored: ScoredFile[] = [];
  for (const file of files) {
    let priority = 3;
    if (matchesAny(file, CONFIG_PATTERNS)) priority = 0;
    else if (matchesAny(file, ENTRY_PATTERNS)) priority = 1;
    else {
      const lang = languageForFile(file);
      if (lang !== 'Unknown') priority = 2;
    }

    let mtime = new Date(0);
    try {
      const stat = await fs.stat(`${root}/${file}`);
      mtime = stat.mtime;
    } catch {
      // best-effort
    }

    scored.push({ path: file, priority, mtime });
  }

  // Sort: priority ASC, then mtime DESC (recently modified first within same tier)
  scored.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.mtime.getTime() - a.mtime.getTime();
  });

  // Pack files until budget is exhausted
  const included: FileEntry[] = [];
  const excluded: string[] = [];
  let totalTokens = 0;

  for (const { path: filePath } of scored) {
    const fullPath = `${root}/${filePath}`;
    let content: string;
    try {
      content = await fs.readFile(fullPath);
    } catch {
      excluded.push(filePath);
      continue;
    }

    const language = languageForFile(filePath);

    if (compress) {
      content = compressCode(content, language);
    }

    const tokens = estimateTokens(content);

    if (maxTokens > 0 && totalTokens + tokens > maxTokens && included.length > 0) {
      excluded.push(filePath);
      continue;
    }

    included.push({ path: filePath, content, language, tokens });
    totalTokens += tokens;
  }

  return { included, excluded, totalTokens };
}
