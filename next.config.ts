import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Workers: pg loads its Workers socket code from pg-cloudflare
  // only on workerd, so the build's file tracing never sees those files.
  // Keep pg out of the bundle and copy pg-cloudflare whole.
  serverExternalPackages: ["pg"],
  outputFileTracingIncludes: { "/**": ["./node_modules/pg-cloudflare/**/*"] },
  cacheComponents: true,
  partialPrefetching: true,
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
