'use client';

import { useWorkspaceStore } from '@/stores/workspace-store';
import { Sun, Moon } from 'lucide-react';

export function TitleBar() {
  const { theme, toggleTheme, agents } = useWorkspaceStore();

  return (
    <div className="flex h-9 items-center justify-between border-b border-panel-border bg-sidebar-bg px-3 select-none">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[13px] font-bold text-sidebar-fg">
          LLM IDE
        </span>
        <span className="text-[12px] text-sidebar-fg/60">Workspace</span>
      </div>

      <div className="flex items-center gap-3">
        {/* Connected agents */}
        {agents.length > 0 && (
          <div className="flex items-center gap-1.5">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: agent.color }}
                title={`${agent.label} — ${agent.status}`}
              />
            ))}
            <span className="text-[11px] text-sidebar-fg/50">
              {agents.length} agent{agents.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="rounded p-1 text-sidebar-fg/70 transition-colors hover:bg-sidebar-hover hover:text-sidebar-fg"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>
    </div>
  );
}
