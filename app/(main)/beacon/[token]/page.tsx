import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchBeaconPublic } from '@/lib/beacon-public';
import BeaconTrackingClient from './BeaconTrackingClient';

interface BeaconPageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: BeaconPageProps): Promise<Metadata> {
  const { token } = await params;
  const data = await fetchBeaconPublic(token);
  const title = data?.routeName ? `Live: ${data.routeName}` : 'Live tracking';
  return {
    title,
    description: 'Live-ish location share — may lag behind reality; check the "last updated" time before relying on it.',
    openGraph: { title, description: 'Live location share from plot', type: 'website' },
    // This link is meant to be reachable by anyone who has it (no login),
    // not discoverable — never index or follow it.
    robots: { index: false, follow: false },
  };
}

// A standalone page, not one of the `redirect('/?...')` shims most of
// app/(main) uses — this must render on its own with no session (the
// partner has never logged into plot), and `proxy.ts`'s matcher
// (`['/', '/activity/:path*']`) doesn't touch `/beacon/*`, so it's public
// by construction, no bypass logic needed here.
export default async function BeaconTrackingPage({ params }: BeaconPageProps) {
  const { token } = await params;
  const data = await fetchBeaconPublic(token);
  if (!data) {
    notFound();
  }
  return <BeaconTrackingClient token={token} initial={data} />;
}
