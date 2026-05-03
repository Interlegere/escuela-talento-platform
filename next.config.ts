import type { NextConfig } from "next";

const allowedDevOrigins = (process.env.DEV_ALLOWED_ORIGINS || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean)

const nextConfig: NextConfig = {
  allowedDevOrigins,
};

export default nextConfig;
