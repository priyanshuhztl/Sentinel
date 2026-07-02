import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Desktop build (Tauri) runs this as a standalone Node sidecar —
  // see desktop/prepare-standalone.mjs and src-tauri/src/sidecar.rs.
  output: 'standalone',
};

export default nextConfig;
