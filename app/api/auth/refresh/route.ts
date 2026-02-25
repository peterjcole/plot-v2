import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;

  // Prevent open redirect: only allow same-origin paths
  const rawNext = searchParams.get('next') ?? '/';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';

  const session = await getSession();

  if (!session.refreshToken) {
    console.warn('[refresh] No refreshToken in session, redirecting to logout', { path: next });
    return NextResponse.redirect(new URL('/api/auth/logout', origin), 303);
  }

  const beforeExpiry = session.expiresAt;

  try {
    // Bypass refreshTokenIfNeeded (which has a "not yet expired" guard) —
    // this route is only reached when we know the token needs refreshing.
    const res = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.STRAVA_CLIENT_ID ?? '',
        client_secret: process.env.STRAVA_CLIENT_SECRET ?? '',
        refresh_token: session.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[refresh] Strava token refresh failed, redirecting to logout', {
        status: res.status,
        path: next,
        body,
      });
      return NextResponse.redirect(new URL('/api/auth/logout', origin), 303);
    }

    const data = await res.json();
    session.accessToken = data.access_token;
    session.refreshToken = data.refresh_token;
    session.expiresAt = data.expires_at;
    // session.save() works correctly in API Route Handlers — cookies() is writable here.
    await session.save();

    console.info('[refresh] Token refreshed successfully', {
      path: next,
      previousExpiresAt: beforeExpiry,
      newExpiresAt: data.expires_at,
    });

    return NextResponse.redirect(new URL(next, origin), 303);
  } catch (error) {
    console.error('[refresh] Unexpected error, redirecting to logout', { path: next, error });
    return NextResponse.redirect(new URL('/api/auth/logout', origin), 303);
  }
}
