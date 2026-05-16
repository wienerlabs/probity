import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  transpilePackages: [
    "@probity/types",
    "@probity/engine",
    "@probity/rules",
    "@probity/solana",
  ],
};

export default config;
