import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  // Disabled to cut peak build memory on the deploy server (was OOM-killing
  // `next build`). Purely a build/perf lever — no functional change. Re-enable
  // once the server has more RAM/swap.
  reactCompiler: false,
  // Keep Prisma + the pg adapter as native Node requires. Without this,
  // Turbopack bundles @prisma/adapter-pg and the generated client, then
  // mangles their external `pg` / `@prisma/client` requires into
  // unresolvable hashed names (e.g. `pg-587764f78a6c7a9c`).
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg", "prisma"],
};

export default nextConfig;
