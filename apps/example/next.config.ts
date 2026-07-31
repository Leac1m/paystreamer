import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@paystreamer/sdk', '@mysten/dapp-kit-react'],
};

export default nextConfig;
