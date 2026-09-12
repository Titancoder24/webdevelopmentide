import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LLM IDE — Cloud IDE for Node.js',
  description:
    'A cloud-based IDE built for the Node.js ecosystem. Connect any AI coding tool via MCP.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-editor-bg text-editor-fg antialiased">
        {children}
      </body>
    </html>
  );
}
