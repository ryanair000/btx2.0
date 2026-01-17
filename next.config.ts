import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Optimize package imports
  experimental: {
    optimizePackageImports: ['react', 'react-dom', 'axios', '@supabase/supabase-js'],
  },
  
  // Disable source maps in production for faster builds
  productionBrowserSourceMaps: false,
};

export default nextConfig;

export default nextConfig;
