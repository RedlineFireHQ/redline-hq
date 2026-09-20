import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "localhost:3000",
    "127.0.0.1:3000",
    "10.110.55.166",
    "10.110.55.166:3000",
    "10.110.59.108",
    "192.168.1.237",
    "192.168.1.22",
  ],
  experimental: {
    instantInsights: {
      validationLevel: "warning",
    },
  },
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;