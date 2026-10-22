import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  outputFileTracingIncludes: { "/*": ["./certs/supabase-root.crt"] },
};

export default nextConfig;
