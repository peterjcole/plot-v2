import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { SessionData, sessionOptions } from '@/lib/auth';
import { refreshTokenIfNeeded } from '@/lib/strava';

export async function proxy(request: NextRequest) {
  const response = NextResponse.next();

  const session = await getIronSession<SessionData>(request, response, sessionOptions);

  if (session.accessToken) {
    try {
      if (await refreshTokenIfNeeded(session)) {
        await session.save();
      }
    } catch {
      // Let the page render with the stale token — it will get a Strava API error
      // rather than crashing the middleware
    }
  }

  return response;
}

export const config = {
  matcher: '/activity/:path*',
};
