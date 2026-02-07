import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', request.nextUrl.origin));
  }

  const session = await getSession();

  if (!state || state !== session.oauthState) {
    return NextResponse.redirect(
      new URL('/?error=invalid_state', request.nextUrl.origin),
    );
  }

  // Clear the state so it can't be replayed
  delete session.oauthState;

  const tokenRes = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(
      new URL('/?error=token_exchange_failed', request.nextUrl.origin),
    );
  }

  const data = await tokenRes.json();

  session.accessToken = data.access_token;
  session.refreshToken = data.refresh_token;
  session.expiresAt = data.expires_at;
  session.athlete = {
    id: data.athlete.id,
    firstname: data.athlete.firstname,
    lastname: data.athlete.lastname,
  };
  await session.save();

  return NextResponse.redirect(new URL('/', request.nextUrl.origin));
}
