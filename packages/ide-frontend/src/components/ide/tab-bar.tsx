'use client';

import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspaceStore } from '@/stores/workspace-store';

export function TabBar() {
  const { openTabs, activeTabPath, setActiveTab, closeTab } =
    useWorkspaceStore();

  if (openTabs.length === 0) return null;

  return (
    <div className="flex h-[35px] shrink-0 items-stretch overflow-x-auto border-b border-tab-border bg-tab-inactive">
      {openTabs.map((tab) => {
        const isActive = tab.path === activeTabPath;
        return (
          <div
            key={tab.path}
            className={cn(
              'group flex min-w-[100px] max-w-[200px] cursor-pointer items-center gap-1.5 border-r border-tab-border px-3 text-[12px]',
              isActive
                ? 'border-b-2 border-b-status-bar bg-tab-active text-editor-fg'
                : 'text-sidebar-fg/70 hover:bg-sidebar-hover'
            )}
            onClick={() => setActiveTab(tab.path)}
          >
            <span className="truncate font-mono">{tab.name}</span>
            {tab.modified && (
              <span className="h-2 w-2 shrink-0 rounded-full bg-editor-fg/60" />
            )}
            <button
              className="ml-auto shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-sidebar-hover group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.path);
              }}
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
