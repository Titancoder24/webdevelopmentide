'use client';

import { useEffect, useRef, useState } from 'react';
import { Terminal as TerminalIcon, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function TerminalPanel() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<import('@xterm/xterm').Terminal | null>(null);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let terminal: import('@xterm/xterm').Terminal | null = null;
    let fitAddon: import('@xterm/addon-fit').FitAddon | null = null;

    async function initTerminal() {
      if (!terminalRef.current) return;

      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');
      const { WebLinksAddon } = await import('@xterm/addon-web-links');

      terminal = new Terminal({
        theme: {
          background: '#1a1a1a',
          foreground: '#cccccc',
          cursor: '#aeafad',
          selectionBackground: 'rgba(38, 79, 120, 0.6)',
          black: '#1e1e1e',
          red: '#f14c4c',
          green: '#89d185',
          yellow: '#cca700',
          blue: '#3794ff',
          magenta: '#d4537e',
          cyan: '#29b8db',
          white: '#cccccc',
        },
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        fontSize: 13,
        lineHeight: 1.4,
        cursorBlink: true,
        cursorStyle: 'bar',
        allowProposedApi: true,
      });

      fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.loadAddon(new WebLinksAddon());

      terminal.open(terminalRef.current);
      fitAddon.fit();

      xtermRef.current = terminal;

      // Welcome message
      terminal.writeln('\x1b[1;36mLLM IDE Terminal\x1b[0m');
      terminal.writeln('\x1b[90mConnected to NodePod runtime\x1b[0m');
      terminal.writeln('');
      terminal.write('\x1b[32m$\x1b[0m ');

      // Basic echo for demo - will be connected to NodePod shell
      let currentLine = '';
      terminal.onData((data) => {
        if (data === '\r') {
          terminal!.writeln('');
          if (currentLine.trim()) {
            terminal!.writeln(`\x1b[90m> ${currentLine}\x1b[0m`);
          }
          currentLine = '';
          terminal!.write('\x1b[32m$\x1b[0m ');
        } else if (data === '\x7f') {
          // Backspace
          if (currentLine.length > 0) {
            currentLine = currentLine.slice(0, -1);
            terminal!.write('\b \b');
          }
        } else if (data >= ' ') {
          currentLine += data;
          terminal!.write(data);
        }
      });

      // Resize observer
      const observer = new ResizeObserver(() => {
        fitAddon?.fit();
      });
      observer.observe(terminalRef.current);

      return () => {
        observer.disconnect();
        terminal?.dispose();
      };
    }

    const cleanup = initTerminal();
    return () => {
      cleanup.then((fn) => fn?.());
    };
  }, []);

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden border-t border-panel-border bg-terminal-bg',
        maximized ? 'absolute inset-0 z-50' : 'h-full'
      )}
    >
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-panel-border px-3">
        <div className="flex items-center gap-1.5">
          <TerminalIcon size={13} className="text-sidebar-fg/60" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-fg/60">
            Terminal
          </span>
        </div>
        <button
          onClick={() => setMaximized(!maximized)}
          className="rounded p-0.5 text-sidebar-fg/40 hover:bg-sidebar-hover hover:text-sidebar-fg"
        >
          {maximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
        </button>
      </div>
      <div ref={terminalRef} className="flex-1 overflow-hidden" />
    </div>
  );
}
