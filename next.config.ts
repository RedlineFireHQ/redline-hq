import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "http://127.0.0.1:3000",
    "http://localhost:3000",
  ],
  experimental: {
    instantInsights: {
      validationLevel: "warning",
    },
  },
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;