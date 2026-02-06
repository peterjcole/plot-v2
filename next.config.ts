import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['puppeteer-core', '@sparticuz/chromium'],
  outputFileTracingIncludes: {
    '/api/activity-printout': ['./node_modules/@sparticuz/chromium/bin/**'],
  },
};

export default nextConfig;
