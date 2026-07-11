import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasPremium } from '@/lib/entitlements';

interface PhotonFeature {
  properties: {
    name?: string;
    county?: string;
    state?: string;
    country?: string;
  };
}

// Reverse-geocodes a saved route's start point into a short "place · region" label.
// Premium-only — location labels are a saved-routes-library concept; free users never
// see or need one.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.athlete || !hasPremium(session)) {
    return new NextResponse(null, { status: 404 });
  }

  const lat = request.nextUrl.searchParams.get('lat');
  const lng = request.nextUrl.searchParams.get('lng');
  if (!lat || !lng) {
    return NextResponse.json({ location: null });
  }

  try {
    const url = new URL('https://photon.komoot.io/reverse');
    url.searchParams.set('lat', lat);
    url.searchParams.set('lon', lng);
    url.searchParams.set('lang', 'en');

    const res = await fetch(url.toString());
    if (!res.ok) {
      return NextResponse.json({ location: null }, { status: 502 });
    }

    const data = await res.json();
    const feature: PhotonFeature | undefined = data.features?.[0];
    if (!feature) {
      return NextResponse.json({ location: null });
    }

    const place = feature.properties.name;
    const region = feature.properties.county || feature.properties.state || feature.properties.country;
    const location = [place, region].filter(Boolean).join(' · ') || null;

    return NextResponse.json({ location });
  } catch {
    return NextResponse.json({ location: null }, { status: 502 });
  }
}
