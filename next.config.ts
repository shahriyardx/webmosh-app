import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  reactCompiler: true,
  // Keep Prisma + the pg adapter as native Node requires. Without this,
  // Turbopack bundles @prisma/adapter-pg and the generated client, then
  // mangles their external `pg` / `@prisma/client` requires into
  // unresolvable hashed names (e.g. `pg-587764f78a6c7a9c`).
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg", "prisma"],
};

export default nextConfig;
