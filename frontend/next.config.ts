import type { NextConfig } from "next";

// MIB_STATIC=1: ekspor statis untuk dibundel ke aplikasi desktop (backend yang menyajikannya, satu port, satu origin).
// Cache Components/PPR tidak didukung di mode ekspor, jadi hanya dipakai pada build biasa.
const staticExport = process.env.MIB_STATIC === "1";

const nextConfig: NextConfig = {
  ...(staticExport
    ? { output: "export" as const, images: { unoptimized: true } }
    : { cacheComponents: true, partialPrefetching: true }),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
