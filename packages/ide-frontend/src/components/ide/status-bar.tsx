'use client';

import { useWorkspaceStore } from '@/stores/workspace-store';

export function StatusBar() {
  const { agents, errors, openTabs, activeTabPath } = useWorkspaceStore();
  const openErrors = errors.filter((e) => e.status === 'open');
  const activeTab = openTabs.find((t) => t.path === activeTabPath);

  return (
    <div className="flex h-6 shrink-0 items-center justify-between bg-status-bar px-3 text-[12px] text-status-fg">
      <div className="flex items-center gap-3">
        {/* Agent status */}
        {agents.length > 0 && (
          <div className="flex items-center gap-1.5">
            {agents.map((a) => (
              <span key={a.id} className="flex items-center gap-1">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: a.color }}
                />
                <span className="opacity-90">
                  {a.label} {a.status !== 'idle' ? a.status : ''}
                </span>
              </span>
            ))}
          </div>
        )}

        {/* Error count */}
        {openErrors.length > 0 && (
          <span className="flex items-center gap-1">
            <span className="font-bold">{openErrors.length}</span> error
            {openErrors.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {activeTab && (
          <span className="opacity-80">{activeTab.language}</span>
        )}
        <span className="opacity-60">LLM IDE v0.1.0</span>
      </div>
    </div>
  );
}
