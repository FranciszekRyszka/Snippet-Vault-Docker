import type { NextConfig } from "next";

// Docker build: emit a self-contained server in .next/standalone so the runtime
// image only needs Node + the traced dependencies (no full node_modules).
const nextConfig: NextConfig = {
  output: "standalone",
  // better-sqlite3 is a native addon — keep it external so Next copies the real
  // module (with its .node binary) into the standalone output instead of trying
  // to bundle it.
  serverExternalPackages: ["better-sqlite3"],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
