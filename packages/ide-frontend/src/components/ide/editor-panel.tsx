'use client';

import dynamic from 'next/dynamic';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { TabBar } from './tab-bar';

const MonacoEditor = dynamic(() => import('@monaco-editor/react').then(m => m.default ? { default: m.default } : m), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-editor-bg text-[13px] text-sidebar-fg/40">
      Loading editor...
    </div>
  ),
});

export function EditorPanel() {
  const {
    openTabs,
    activeTabPath,
    fileContents,
    setFileContent,
    markTabModified,
    theme,
  } = useWorkspaceStore();

  const activeTab = openTabs.find((t) => t.path === activeTabPath);
  const content = activeTabPath ? fileContents[activeTabPath] ?? '' : '';

  return (
    <div className="flex h-full flex-col overflow-hidden bg-editor-bg">
      <TabBar />
      {activeTab ? (
        <div className="flex-1 overflow-hidden">
          <MonacoEditor
            language={activeTab.language}
            value={content}
            theme={theme === 'dark' ? 'vs-dark' : 'vs'}
            onChange={(value) => {
              if (activeTabPath && value !== undefined) {
                setFileContent(activeTabPath, value);
                markTabModified(activeTabPath, true);
              }
            }}
            options={{
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              padding: { top: 8 },
              lineNumbers: 'on',
              renderLineHighlight: 'line',
              bracketPairColorization: { enabled: true },
              automaticLayout: true,
              tabSize: 2,
              wordWrap: 'on',
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
            }}
          />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-sidebar-fg/30">
          <div className="text-center">
            <p className="font-mono text-[14px]">LLM IDE</p>
            <p className="mt-2 text-[12px]">Open a file to start editing</p>
          </div>
        </div>
      )}
    </div>
  );
}
