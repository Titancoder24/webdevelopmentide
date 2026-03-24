import { create } from 'zustand';

export interface FileTab {
  path: string;
  name: string;
  language: string;
  modified: boolean;
  agentColor?: string;
}

export interface DirectoryEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: DirectoryEntry[];
}

export interface AgentCursor {
  id: string;
  label: string;
  color: string;
  file: string;
  line: number;
  column: number;
  status: 'idle' | 'reading' | 'writing' | 'executing';
  visible: boolean;
}

export interface WorkspaceError {
  id: string;
  source: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  file?: string;
  line?: number;
  status: 'open' | 'resolved';
}

export interface ActivityEntry {
  id: string;
  agent: string;
  color: string;
  timestamp: string;
  action: string;
  detail: string;
}

interface WorkspaceState {
  // File explorer
  fileTree: DirectoryEntry[];
  setFileTree: (tree: DirectoryEntry[]) => void;

  // Tabs
  openTabs: FileTab[];
  activeTabPath: string | null;
  openFile: (path: string, name: string, language?: string) => void;
  closeTab: (path: string) => void;
  setActiveTab: (path: string) => void;
  markTabModified: (path: string, modified: boolean) => void;

  // Editor content
  fileContents: Record<string, string>;
  setFileContent: (path: string, content: string) => void;

  // Panels
  sidebarOpen: boolean;
  terminalOpen: boolean;
  previewOpen: boolean;
  activityPanelOpen: boolean;
  toggleSidebar: () => void;
  toggleTerminal: () => void;
  togglePreview: () => void;
  toggleActivityPanel: () => void;

  // Theme
  theme: 'dark' | 'light';
  toggleTheme: () => void;

  // AI Agents
  agents: AgentCursor[];
  setAgents: (agents: AgentCursor[]) => void;

  // Errors
  errors: WorkspaceError[];
  setErrors: (errors: WorkspaceError[]) => void;

  // Activity feed
  activities: ActivityEntry[];
  addActivity: (entry: ActivityEntry) => void;

  // Preview
  previewUrl: string | null;
  setPreviewUrl: (url: string | null) => void;
}

function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescriptreact',
    js: 'javascript', jsx: 'javascriptreact',
    json: 'json', css: 'css', html: 'html',
    md: 'markdown', yaml: 'yaml', yml: 'yaml',
    svg: 'xml', xml: 'xml',
  };
  return map[ext || ''] || 'plaintext';
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  fileTree: [],
  setFileTree: (tree) => set({ fileTree: tree }),

  openTabs: [],
  activeTabPath: null,
  openFile: (path, name, language) =>
    set((state) => {
      const exists = state.openTabs.find((t) => t.path === path);
      if (exists) {
        return { activeTabPath: path };
      }
      return {
        openTabs: [
          ...state.openTabs,
          {
            path,
            name,
            language: language || getLanguageFromPath(path),
            modified: false,
          },
        ],
        activeTabPath: path,
      };
    }),
  closeTab: (path) =>
    set((state) => {
      const tabs = state.openTabs.filter((t) => t.path !== path);
      const newActive =
        state.activeTabPath === path
          ? tabs[tabs.length - 1]?.path || null
          : state.activeTabPath;
      const { [path]: _, ...rest } = state.fileContents;
      return { openTabs: tabs, activeTabPath: newActive, fileContents: rest };
    }),
  setActiveTab: (path) => set({ activeTabPath: path }),
  markTabModified: (path, modified) =>
    set((state) => ({
      openTabs: state.openTabs.map((t) =>
        t.path === path ? { ...t, modified } : t
      ),
    })),

  fileContents: {},
  setFileContent: (path, content) =>
    set((state) => ({
      fileContents: { ...state.fileContents, [path]: content },
    })),

  sidebarOpen: true,
  terminalOpen: true,
  previewOpen: true,
  activityPanelOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleTerminal: () => set((s) => ({ terminalOpen: !s.terminalOpen })),
  togglePreview: () => set((s) => ({ previewOpen: !s.previewOpen })),
  toggleActivityPanel: () =>
    set((s) => ({ activityPanelOpen: !s.activityPanelOpen })),

  theme: 'dark',
  toggleTheme: () =>
    set((s) => {
      const next = s.theme === 'dark' ? 'light' : 'dark';
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('light', next === 'light');
      }
      return { theme: next };
    }),

  agents: [],
  setAgents: (agents) => set({ agents }),

  errors: [],
  setErrors: (errors) => set({ errors }),

  activities: [],
  addActivity: (entry) =>
    set((s) => ({
      activities: [entry, ...s.activities].slice(0, 200),
    })),

  previewUrl: null,
  setPreviewUrl: (url) => set({ previewUrl: url }),
}));
