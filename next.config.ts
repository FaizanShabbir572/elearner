import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  serverExternalPackages: ["nodemailer", "@libsql/client", "@prisma/adapter-libsql"],
};
export default nextConfig;
