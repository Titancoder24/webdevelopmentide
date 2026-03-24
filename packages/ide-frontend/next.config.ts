import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@llm-ide/mcp-server',
    '@llm-ide/context-engine',
    '@llm-ide/error-collector',
  ],
  webpack: (config) => {
    // Required for Monaco Editor
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };
    return config;
  },
};

export default nextConfig;
