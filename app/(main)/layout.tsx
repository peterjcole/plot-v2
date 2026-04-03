import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Ribeye_Marrow } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/react";
import "../globals.css";

const ibmPlexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
});

const ribeyeMarrow = Ribeye_Marrow({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-ribeye-marrow",
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: "Plot",
    template: "%s – Plot",
  },
  description: "Visualise your Strava activities on OS / topo maps",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${ibmPlexMono.variable} ${ribeyeMarrow.variable} antialiased`}
      >
        {children}
        <Analytics />
        <Script
          defer
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon='{"token": "c25b7e69962d4a34927987a3d6b23ce1"}'
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
