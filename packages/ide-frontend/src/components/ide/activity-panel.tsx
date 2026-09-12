'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { AlertCircle, Activity } from 'lucide-react';

type PanelTab = 'activity' | 'errors';

export function ActivityPanel() {
  const [activeTab, setActiveTab] = useState<PanelTab>('activity');
  const { activities, errors, agents } = useWorkspaceStore();

  const openErrors = errors.filter((e) => e.status === 'open');

  return (
    <div className="flex h-full flex-col overflow-hidden border-l border-panel-border bg-panel-bg">
      {/* Tab headers */}
      <div className="flex h-8 shrink-0 items-stretch border-b border-panel-border">
        <button
          className={cn(
            'flex items-center gap-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider transition-colors',
            activeTab === 'activity'
              ? 'border-b-2 border-b-status-bar text-sidebar-fg'
              : 'text-sidebar-fg/50 hover:text-sidebar-fg/70'
          )}
          onClick={() => setActiveTab('activity')}
        >
          <Activity size={12} />
          AI Activity
        </button>
        <button
          className={cn(
            'flex items-center gap-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider transition-colors',
            activeTab === 'errors'
              ? 'border-b-2 border-b-status-bar text-sidebar-fg'
              : 'text-sidebar-fg/50 hover:text-sidebar-fg/70'
          )}
          onClick={() => setActiveTab('errors')}
        >
          <AlertCircle size={12} />
          Errors
          {openErrors.length > 0 && (
            <span className="ml-1 rounded-full bg-ide-error px-1.5 text-[10px] font-bold text-white">
              {openErrors.length}
            </span>
          )}
        </button>
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'activity' ? (
          <div className="p-2">
            {agents.length > 0 && (
              <div className="mb-3 space-y-1 border-b border-panel-border pb-2">
                {agents.map((agent) => (
                  <div key={agent.id} className="flex items-center gap-2 px-1">
                    <div
                      className={cn(
                        'h-2 w-2 shrink-0 rounded-full',
                        agent.status !== 'idle' && 'animate-pulse'
                      )}
                      style={{ backgroundColor: agent.color }}
                    />
                    <span className="text-[12px] text-panel-fg">
                      <span className="font-semibold">{agent.label}</span>{' '}
                      <span className="text-sidebar-fg/50">
                        {agent.status === 'idle'
                          ? 'idle'
                          : `${agent.status} ${agent.file}${agent.line ? `:${agent.line}` : ''}`}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
            {activities.length === 0 ? (
              <div className="px-2 py-4 text-center text-[12px] text-sidebar-fg/30">
                No AI activity yet
              </div>
            ) : (
              <div className="space-y-0.5">
                {activities.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-2 rounded px-1 py-0.5 hover:bg-sidebar-hover"
                  >
                    <div
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="font-mono text-[11px] text-sidebar-fg/40">
                        {entry.timestamp}
                      </span>
                      <p className="text-[12px] text-panel-fg">
                        {entry.action}
                      </p>
                      {entry.detail && (
                        <p className="truncate text-[11px] text-sidebar-fg/50">
                          {entry.detail}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-2">
            {openErrors.length === 0 ? (
              <div className="px-2 py-4 text-center text-[12px] text-ide-success">
                No errors
              </div>
            ) : (
              <div className="space-y-1">
                {openErrors.map((err) => (
                  <button
                    key={err.id}
                    className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left hover:bg-sidebar-hover"
                  >
                    <AlertCircle
                      size={13}
                      className={cn(
                        'mt-0.5 shrink-0',
                        err.severity === 'error'
                          ? 'text-ide-error'
                          : err.severity === 'warning'
                            ? 'text-ide-warning'
                            : 'text-ide-info'
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] text-panel-fg">
                        {err.message}
                      </p>
                      {err.file && (
                        <p className="truncate font-mono text-[11px] text-sidebar-fg/50">
                          {err.file}
                          {err.line ? `:${err.line}` : ''}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
