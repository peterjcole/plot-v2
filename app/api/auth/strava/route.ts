import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await getSession();
  const state = randomBytes(32).toString('hex');
  session.oauthState = state;
  await session.save();

  const redirectUri = `${request.nextUrl.origin}/api/auth/callback`;

  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'activity:read_all',
    approval_prompt: 'auto',
    state,
  });

  return NextResponse.redirect(
    `https://www.strava.com/oauth/authorize?${params.toString()}`,
  );
}
