import type { Metadata } from "next";
import { Geist, Geist_Mono, Ribeye_Marrow } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/react";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const ribeyeMarrow = Ribeye_Marrow({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-ribeye-marrow",
});

export const metadata: Metadata = {
  title: {
    default: "Plot",
    template: "%s – Plot",
  },
  description: "Visualise your Strava activities on Ordnance Survey maps",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${ribeyeMarrow.variable} antialiased`}
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
