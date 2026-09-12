'use client';

import { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useWorkspaceStore,
  type DirectoryEntry,
} from '@/stores/workspace-store';

function FileTreeNode({
  entry,
  depth = 0,
}: {
  entry: DirectoryEntry;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const { openFile, activeTabPath } = useWorkspaceStore();
  const isActive = activeTabPath === entry.path;

  if (entry.type === 'directory') {
    return (
      <div>
        <button
          className={cn(
            'flex w-full items-center gap-1 py-0.5 text-left font-mono text-[13px] text-sidebar-fg hover:bg-sidebar-hover',
            isActive && 'bg-sidebar-active'
          )}
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronDown size={14} className="shrink-0 opacity-60" />
          ) : (
            <ChevronRight size={14} className="shrink-0 opacity-60" />
          )}
          {expanded ? (
            <FolderOpen size={14} className="shrink-0 text-ide-warning" />
          ) : (
            <Folder size={14} className="shrink-0 text-ide-warning" />
          )}
          <span className="truncate">{entry.name}</span>
        </button>
        {expanded && entry.children && (
          <div>
            {entry.children.map((child) => (
              <FileTreeNode
                key={child.path}
                entry={child}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      className={cn(
        'flex w-full items-center gap-1 py-0.5 text-left font-mono text-[13px] text-sidebar-fg hover:bg-sidebar-hover',
        isActive && 'bg-sidebar-active text-editor-fg'
      )}
      style={{ paddingLeft: `${depth * 12 + 4}px` }}
      onClick={() => openFile(entry.path, entry.name)}
    >
      <span className="w-[14px] shrink-0" />
      <File size={14} className="shrink-0 opacity-60" />
      <span className="truncate">{entry.name}</span>
    </button>
  );
}

export function FileExplorer() {
  const { fileTree } = useWorkspaceStore();

  return (
    <div className="flex h-full flex-col overflow-hidden bg-sidebar-bg">
      <div className="flex h-8 items-center border-b border-sidebar-border px-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-fg/60">
          Explorer
        </span>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-1">
        {fileTree.length === 0 ? (
          <div className="px-3 py-4 text-center text-[12px] text-sidebar-fg/40">
            No files yet
          </div>
        ) : (
          fileTree.map((entry) => (
            <FileTreeNode key={entry.path} entry={entry} />
          ))
        )}
      </div>
    </div>
  );
}
