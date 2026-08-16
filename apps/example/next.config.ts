import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@paystreamer/sdk', '@mysten/dapp-kit-react'],
  // Recommended directly by @mysten/walrus's own docs for Next.js: without
  // this, bundling its WASM loader can break how it locates the binary at
  // runtime (Turbopack in particular surfaces this as an ENOENT on a
  // virtualized /ROOT/... path) — reproduced live while wiring up
  // /gated-content before this was added.
  serverExternalPackages: ['@mysten/walrus', '@mysten/walrus-wasm'],
};

export default nextConfig;
