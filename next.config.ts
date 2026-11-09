import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['169.254.83.107'],
  serverExternalPackages: ["nodemailer"],
};

export default nextConfig;
