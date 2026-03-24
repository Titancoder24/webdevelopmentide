'use client';

import { useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { TitleBar } from './title-bar';
import { FileExplorer } from './file-explorer';
import { EditorPanel } from './editor-panel';
import { TerminalPanel } from './terminal-panel';
import { PreviewPanel } from './preview-panel';
import { ActivityPanel } from './activity-panel';
import { StatusBar } from './status-bar';

const DEMO_FILE_TREE = [
  {
    name: 'src',
    path: '/src',
    type: 'directory' as const,
    children: [
      {
        name: 'app',
        path: '/src/app',
        type: 'directory' as const,
        children: [
          { name: 'layout.tsx', path: '/src/app/layout.tsx', type: 'file' as const },
          { name: 'page.tsx', path: '/src/app/page.tsx', type: 'file' as const },
        ],
      },
      {
        name: 'lib',
        path: '/src/lib',
        type: 'directory' as const,
        children: [
          { name: 'auth.ts', path: '/src/lib/auth.ts', type: 'file' as const },
          { name: 'db.ts', path: '/src/lib/db.ts', type: 'file' as const },
        ],
      },
      { name: 'index.ts', path: '/src/index.ts', type: 'file' as const },
    ],
  },
  { name: 'package.json', path: '/package.json', type: 'file' as const },
  { name: 'tsconfig.json', path: '/tsconfig.json', type: 'file' as const },
];

const DEMO_FILE_CONTENTS: Record<string, string> = {
  '/src/index.ts': `import express from 'express';

const app = express();
const PORT = 3000;

app.get('/', (req, res) => {
  res.json({ message: 'Hello from LLM IDE!' });
});

app.listen(PORT, () => {
  console.log(\`Server running on http://localhost:\${PORT}\`);
});
`,
  '/src/lib/auth.ts': `export interface User {
  id: string;
  email: string;
  name: string;
}

export async function getUser(id: string): Promise<User | null> {
  // TODO: implement database lookup
  return null;
}

export async function verifyToken(token: string): Promise<boolean> {
  if (!token) return false;
  // TODO: implement JWT verification
  return true;
}
`,
  '/src/lib/db.ts': `// Database connection module

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
}

let connection: unknown = null;

export async function connect(config: DatabaseConfig): Promise<void> {
  // TODO: implement database connection
  console.log(\`Connecting to \${config.host}:\${config.port}/\${config.database}\`);
}

export async function disconnect(): Promise<void> {
  connection = null;
}
`,
  '/src/app/layout.tsx': `export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`,
  '/src/app/page.tsx': `export default function HomePage() {
  return (
    <main>
      <h1>Welcome to LLM IDE</h1>
      <p>Start building with AI-powered development.</p>
    </main>
  );
}
`,
  '/package.json': `{
  "name": "my-workspace",
  "version": "1.0.0",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc"
  },
  "dependencies": {
    "express": "^4.18.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "tsx": "^4.0.0",
    "@types/express": "^4.17.0"
  }
}
`,
  '/tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
`,
};

export function IDELayout() {
  const {
    sidebarOpen,
    terminalOpen,
    previewOpen,
    activityPanelOpen,
    toggleSidebar,
    toggleTerminal,
    togglePreview,
    setFileTree,
    setFileContent,
    openFile,
  } = useWorkspaceStore();

  // Load demo data on mount
  useEffect(() => {
    setFileTree(DEMO_FILE_TREE);
    for (const [path, content] of Object.entries(DEMO_FILE_CONTENTS)) {
      setFileContent(path, content);
    }
    // Open a default file
    openFile('/src/index.ts', 'index.ts');
  }, [setFileTree, setFileContent, openFile]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'b') {
          e.preventDefault();
          toggleSidebar();
        } else if (e.key === 'j') {
          e.preventDefault();
          toggleTerminal();
        } else if (e.key === 'p' && e.shiftKey) {
          e.preventDefault();
          togglePreview();
        }
      }
    },
    [toggleSidebar, toggleTerminal, togglePreview]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <TitleBar />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - File Explorer */}
        {sidebarOpen && (
          <div
            className="shrink-0 overflow-hidden border-r border-sidebar-border"
            style={{ width: 240, minWidth: 180, maxWidth: 400 }}
          >
            <FileExplorer />
          </div>
        )}

        {/* Main content area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex flex-1 overflow-hidden">
            {/* Editor */}
            <div className="flex flex-1 flex-col overflow-hidden" style={{ minWidth: 300 }}>
              <div className={cn('flex-1 overflow-hidden', terminalOpen && 'flex flex-col')}>
                <div className={cn(terminalOpen ? 'flex-1 overflow-hidden' : 'h-full')}>
                  <EditorPanel />
                </div>
                {terminalOpen && (
                  <div style={{ height: 200, minHeight: 100, maxHeight: 500 }}>
                    <TerminalPanel />
                  </div>
                )}
              </div>
            </div>

            {/* Preview */}
            {previewOpen && (
              <div
                className="shrink-0 overflow-hidden"
                style={{ width: 380, minWidth: 280, maxWidth: 600 }}
              >
                <PreviewPanel />
              </div>
            )}

            {/* Activity Panel */}
            {activityPanelOpen && (
              <div
                className="shrink-0 overflow-hidden"
                style={{ width: 280, minWidth: 220, maxWidth: 400 }}
              >
                <ActivityPanel />
              </div>
            )}
          </div>
        </div>
      </div>

      <StatusBar />
    </div>
  );
}
