import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@xyflow/react'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Mark these packages as external during SSR to avoid Node.js API issues
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push({
          'docx-preview': 'commonjs docx-preview',
          'xlsx': 'commonjs xlsx',
        });
      }
    }
    return config;
  },
};

export default nextConfig;
