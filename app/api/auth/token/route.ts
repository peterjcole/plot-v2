import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

/**
 * Receives JWT from backend OAuth flow via URL param.
 * Stores it in iron-session and redirects to the app.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const error = request.nextUrl.searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL(`/?error=${error}`, request.nextUrl.origin));
  }

  if (!token) {
    return NextResponse.redirect(new URL('/?error=no_token', request.nextUrl.origin));
  }

  // Decode JWT payload to extract athlete info (no verification needed —
  // the backend signed it, and we just need the claims for display)
  try {
    const payloadB64 = token.split('.')[1];
    const payload = JSON.parse(atob(payloadB64));

    const session = await getSession();
    session.jwt = token;
    session.athlete = {
      id: payload.athlete_id,
      firstname: payload.firstname,
      lastname: payload.lastname,
    };
    await session.save();

    return NextResponse.redirect(new URL('/', request.nextUrl.origin));
  } catch {
    return NextResponse.redirect(new URL('/?error=invalid_token', request.nextUrl.origin));
  }
}
