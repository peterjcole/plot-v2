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
  // Strava only accepts redirect_uris under this app's registered callback
  // domain (plot.fit) — plot-backend's mobile Strava login lives on its own
  // workers.dev domain, so its /auth/* routes are proxied here instead of
  // the mobile app talking to plot-backend directly. See plot-backend's
  // MOBILE_AUTH_PUBLIC_URL and plot-ios/docs/DESIGN.md.
  async rewrites() {
    return [
      {
        source: '/api/mobile/auth/:path*',
        destination: 'https://plot-backend.hold-it.workers.dev/auth/:path*',
      },
    ];
  },
};

export default nextConfig;
