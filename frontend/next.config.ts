import type { NextConfig } from "next";

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
