import type { NextConfig } from "next";

// Headers de segurança em todas as respostas (ADR-0028). CSP estrita fica fora por ora
// (atrito alto com Next/inline); estes cobrem o essencial: HTTPS forçado, anti-sniff,
// anti-clickjacking, referrer enxuto e bloqueio de APIs sensíveis do navegador.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // ESLint flat config será adicionado na Fatia 1; por ora não bloqueia o build.
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
