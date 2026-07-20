import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const clientId = process.env.STRAVA_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: 'STRAVA_CLIENT_ID is not configured' },
      { status: 500 },
    );
  }

  const session = await getSession();
  const state = randomBytes(32).toString('hex');
  session.oauthState = state;
  await session.save();

  const redirectUri = `${request.nextUrl.origin}/api/auth/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    // activity:write added for plot-ios's Strava auto-upload feature: this
    // web login also bootstraps its Strava token into plot-backend
    // (bootstrapPremiumAccess → POST /users/bootstrap), the same token
    // store the mobile upload path reads from, so it needs the same scope.
    // Not retroactive — anyone who logged in before this shipped needs one
    // re-login to grant it.
    scope: 'read,activity:read_all,activity:write',
    approval_prompt: 'auto',
    state,
  });

  return NextResponse.redirect(
    `https://www.strava.com/oauth/authorize?${params.toString()}`,
  );
}
