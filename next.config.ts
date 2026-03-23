import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@xyflow/react'],
  // Use webpack instead of turbopack to handle docx-preview/xlsx SSR issues
  experimental: {
    // This helps with packages that have issues with SSR
  },
};

export default nextConfig;
