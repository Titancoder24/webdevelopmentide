import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Workspace } from '../workspace.js';

export function register(server: McpServer, workspace: Workspace): void {
  server.tool(
    'get_resource_usage',
    'Get current CPU, memory, disk, and network usage.',
    {},
    async () => {
      const usage = await workspace.getResourceUsage();
      const lines = [
        `CPU: ${usage.cpu.toFixed(1)}%`,
        `Memory: ${usage.memory.used}MB / ${usage.memory.total}MB (${usage.memory.percentage.toFixed(1)}%)`,
        `Disk: ${usage.disk.used}MB / ${usage.disk.total}MB (${usage.disk.percentage.toFixed(1)}%)`,
        `Network: RX ${usage.network.rx}KB / TX ${usage.network.tx}KB`,
        `Uptime: ${Math.floor(usage.uptime / 60)}m ${usage.uptime % 60}s`,
      ];
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    },
  );
}
