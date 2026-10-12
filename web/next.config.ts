import type { NextConfig } from "next";

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
      // fino a 5 foto per segnalazione; il browser le ridimensiona prima dell'invio
      bodySizeLimit: "12mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
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
