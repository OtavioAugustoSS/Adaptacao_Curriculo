import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ESLint flat config será adicionado na Fatia 1; por ora não bloqueia o build.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
