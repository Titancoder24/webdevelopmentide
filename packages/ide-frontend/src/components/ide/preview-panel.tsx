'use client';

import { ExternalLink, RefreshCw } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useState } from 'react';

export function PreviewPanel() {
  const { previewUrl } = useWorkspaceStore();
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="flex h-full flex-col overflow-hidden border-l border-panel-border bg-panel-bg">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-panel-border px-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-fg/60">
          Preview
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="rounded p-0.5 text-sidebar-fg/40 hover:bg-sidebar-hover hover:text-sidebar-fg"
            title="Refresh preview"
          >
            <RefreshCw size={12} />
          </button>
          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded p-0.5 text-sidebar-fg/40 hover:bg-sidebar-hover hover:text-sidebar-fg"
              title="Open in new tab"
            >
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-hidden bg-white">
        {previewUrl ? (
          <iframe
            key={refreshKey}
            src={previewUrl}
            className="h-full w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            title="Live Preview"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-editor-bg">
            <div className="text-center text-sidebar-fg/30">
              <p className="text-[13px]">No preview available</p>
              <p className="mt-1 text-[11px]">
                Run a dev server to see the preview
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
