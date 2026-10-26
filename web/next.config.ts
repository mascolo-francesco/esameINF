import type { NextConfig } from "next";

const sviluppo = process.env.NODE_ENV !== "production";

// Next inserisce script inline per l'idratazione, quindi 'unsafe-inline' resta; la policy
// blocca comunque script e connessioni verso altri domini, plugin, <base> e form esterni.
// Le mappe arrivano da OpenFreeMap; il worker di MapLibre è in /maplibre.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${sviluppo ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tiles.openfreemap.org",
  "font-src 'self' data:",
  `connect-src 'self' https://tiles.openfreemap.org${sviluppo ? " ws:" : ""}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(sviluppo ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
  // sharp e argon2 hanno moduli nativi: restano fuori dal bundle del server
  serverExternalPackages: ["sharp", "@node-rs/argon2"],
  experimental: {
    authInterrupts: true, // forbidden() per le pagine riservate allo staff
    serverActions: {
      // fino a 5 foto per segnalazione, ridimensionate nel browser sotto gli 800 KB l'una.
      // Su Vercel il limite della piattaforma è 4,5 MB per richiesta.
      bodySizeLimit: "4.5mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
