import type { FileSystem, ProjectInfo } from './types.js';
import { estimateTokens } from './token-counter.js';

// ---------------------------------------------------------------------------
// Language mapping
// ---------------------------------------------------------------------------

const EXT_LANG: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.mjs': 'JavaScript',
  '.cjs': 'JavaScript',
  '.vue': 'Vue',
  '.svelte': 'Svelte',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.less': 'Less',
  '.html': 'HTML',
  '.json': 'JSON',
  '.md': 'Markdown',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.toml': 'TOML',
  '.py': 'Python',
  '.rs': 'Rust',
  '.go': 'Go',
  '.java': 'Java',
  '.rb': 'Ruby',
  '.php': 'PHP',
  '.sh': 'Shell',
  '.sql': 'SQL',
  '.graphql': 'GraphQL',
  '.gql': 'GraphQL',
  '.prisma': 'Prisma',
  '.proto': 'Protobuf',
  '.dockerfile': 'Docker',
  '.tf': 'Terraform',
};

function extOf(filePath: string): string {
  const m = filePath.match(/(\.[^./]+)$/);
  return m ? m[1].toLowerCase() : '';
}

export function languageForFile(filePath: string): string {
  const basename = filePath.split('/').pop() ?? '';
  if (basename === 'Dockerfile') return 'Docker';
  if (basename === 'Makefile') return 'Makefile';
  return EXT_LANG[extOf(filePath)] ?? 'Unknown';
}

// ---------------------------------------------------------------------------
// Framework detection helpers
// ---------------------------------------------------------------------------

interface FrameworkSignal {
  name: string;
  /** package.json dependency names that indicate this framework */
  deps: string[];
  /** Config files whose existence strongly signals this framework */
  configs: string[];
}

const FRAMEWORK_SIGNALS: FrameworkSignal[] = [
  { name: 'Next.js', deps: ['next'], configs: ['next.config.js', 'next.config.mjs', 'next.config.ts'] },
  { name: 'Vinext', deps: ['vinext'], configs: ['vinext.config.ts', 'vinext.config.js'] },
  { name: 'Nuxt', deps: ['nuxt'], configs: ['nuxt.config.ts', 'nuxt.config.js'] },
  { name: 'SvelteKit', deps: ['@sveltejs/kit'], configs: ['svelte.config.js'] },
  { name: 'Remix', deps: ['@remix-run/react'], configs: ['remix.config.js'] },
  { name: 'Astro', deps: ['astro'], configs: ['astro.config.mjs', 'astro.config.ts'] },
  { name: 'Expo', deps: ['expo'], configs: ['app.json', 'app.config.js', 'app.config.ts'] },
  { name: 'React', deps: ['react'], configs: [] },
  { name: 'Vue', deps: ['vue'], configs: [] },
  { name: 'Svelte', deps: ['svelte'], configs: [] },
  { name: 'Hono', deps: ['hono'], configs: [] },
  { name: 'Express', deps: ['express'], configs: [] },
  { name: 'Fastify', deps: ['fastify'], configs: [] },
  { name: 'Koa', deps: ['koa'], configs: [] },
  { name: 'Elysia', deps: ['elysia'], configs: [] },
];

// ---------------------------------------------------------------------------
// Package manager detection
// ---------------------------------------------------------------------------

async function detectPackageManager(fs: FileSystem, root: string): Promise<string> {
  if (await fs.exists(`${root}/pnpm-lock.yaml`)) return 'pnpm';
  if (await fs.exists(`${root}/yarn.lock`)) return 'yarn';
  if (await fs.exists(`${root}/bun.lockb`)) return 'bun';
  return 'npm';
}

// ---------------------------------------------------------------------------
// Main detector
// ---------------------------------------------------------------------------

export async function detectProject(fs: FileSystem, root: string): Promise<ProjectInfo> {
  // -- Read package.json ---------------------------------------------------
  let pkgJson: Record<string, any> = {};
  try {
    const raw = await fs.readFile(`${root}/package.json`);
    pkgJson = JSON.parse(raw);
  } catch {
    // No package.json – that's fine, we'll produce partial results
  }

  const allDeps: Record<string, string> = {
    ...(pkgJson.dependencies ?? {}),
    ...(pkgJson.devDependencies ?? {}),
  };

  // -- Detect framework ----------------------------------------------------
  let framework = 'Unknown';
  for (const signal of FRAMEWORK_SIGNALS) {
    const hasDep = signal.deps.some((d) => d in allDeps);
    if (!hasDep) continue;

    // If there are config files listed, check for them to increase confidence
    if (signal.configs.length > 0) {
      const hasConfig = await Promise.all(
        signal.configs.map((c) => fs.exists(`${root}/${c}`)),
      );
      if (hasConfig.some(Boolean)) {
        framework = signal.name;
        break;
      }
    }

    // Accept dep-only match but keep looking for a more specific match
    if (framework === 'Unknown') {
      framework = signal.name;
    }
  }

  // -- Enumerate files & compute language stats ----------------------------
  let allFiles: string[] = [];
  try {
    allFiles = await fs.readdir(root, true);
  } catch {
    // empty
  }

  const languages: Record<string, number> = {};
  let totalTokens = 0;

  for (const file of allFiles) {
    const lang = languageForFile(file);
    if (lang === 'Unknown') continue;
    languages[lang] = (languages[lang] ?? 0) + 1;
  }

  // Convert counts to percentages
  const totalCountable = Object.values(languages).reduce((a, b) => a + b, 0) || 1;
  const langPcts: Record<string, number> = {};
  for (const [lang, count] of Object.entries(languages)) {
    langPcts[lang] = Math.round((count / totalCountable) * 1000) / 10;
  }

  // -- Entry points from package.json scripts ------------------------------
  const entryPoints: Record<string, string> = {};
  const scripts = pkgJson.scripts ?? {};
  for (const [name, cmd] of Object.entries(scripts)) {
    entryPoints[name] = String(cmd);
  }

  if (pkgJson.main) entryPoints['main'] = pkgJson.main;
  if (pkgJson.module) entryPoints['module'] = pkgJson.module;

  // -- Environment variable names from .env.example ------------------------
  let envVars: string[] = [];
  try {
    const envExample = await fs.readFile(`${root}/.env.example`);
    envVars = envExample
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => line.split('=')[0]!.trim())
      .filter(Boolean);
  } catch {
    // .env.example may not exist -- also try .env.local, .env.template
    for (const alt of ['.env.local', '.env.template', '.env']) {
      try {
        const raw = await fs.readFile(`${root}/${alt}`);
        envVars = raw
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith('#'))
          .map((l) => l.split('=')[0]!.trim())
          .filter(Boolean);
        if (envVars.length > 0) break;
      } catch {
        // continue
      }
    }
  }

  // -- Package manager as extra info ---------------------------------------
  const pm = await detectPackageManager(fs, root);

  return {
    name: pkgJson.name ?? root.split('/').pop() ?? 'unknown',
    framework: `${framework} (${pm})`,
    languages: langPcts,
    totalFiles: allFiles.length,
    totalTokens, // will be filled by packer after reading content
    entryPoints,
    envVars,
  };
}
