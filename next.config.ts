import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Workers: pg loads its Workers socket code from pg-cloudflare
  // only on workerd, so the build's file tracing never sees those files.
  // Keep pg out of the bundle and copy pg-cloudflare whole.
  serverExternalPackages: ["pg"],
  outputFileTracingIncludes: { "/**": ["./node_modules/pg-cloudflare/**/*"] },
  // Cache Components (and partial prefetching, which needs it) stay off: its
  // staged rendering depends on Node's timers, and on Cloudflare Workers pages
  // hang ("cannot guarantee that Cache Components will run as expected").
  // Pages still read live data inside <Suspense> after connection().
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
