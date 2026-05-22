import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['puppeteer-core', '@sparticuz/chromium', 'sharp'],
  outputFileTracingIncludes: {
    '/api/activity-printout': ['./node_modules/@sparticuz/chromium/bin/**'],
    '/api/wallpaper': ['./fonts/**'],
  },
  async redirects() {
    return [
      {
        source: '/plan',
        destination: '/planner',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
