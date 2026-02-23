import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { SessionData, sessionOptions } from '@/lib/auth';
import { refreshTokenIfNeeded } from '@/lib/strava';

export async function proxy(request: NextRequest) {
  const response = NextResponse.next();

  if (!request.cookies.has(sessionOptions.cookieName)) {
    return response;
  }

  const session = await getIronSession<SessionData>(request, response, sessionOptions);

  if (session.accessToken) {
    try {
      if (await refreshTokenIfNeeded(session)) {
        await session.save(); // Writes encrypted session to response (Set-Cookie for browser)

        // Also propagate the refreshed session into the request headers so the
        // downstream server component reads the fresh token via getSession() /
        // cookies(). Without this, server components always see the original
        // (expired) incoming cookie even though the browser gets the new one.
        const refreshedCookie = response.cookies.get(sessionOptions.cookieName);
        if (refreshedCookie) {
          const requestHeaders = new Headers(request.headers);
          const existingCookies = requestHeaders.get('cookie') ?? '';
          const updatedCookies = existingCookies
            .split('; ')
            .filter((c) => !c.startsWith(`${sessionOptions.cookieName}=`))
            .concat(`${sessionOptions.cookieName}=${refreshedCookie.value}`)
            .join('; ');
          requestHeaders.set('cookie', updatedCookies);

          const newResponse = NextResponse.next({ request: { headers: requestHeaders } });
          newResponse.cookies.set({
            name: refreshedCookie.name,
            value: refreshedCookie.value,
            path: refreshedCookie.path,
            httpOnly: refreshedCookie.httpOnly,
            secure: refreshedCookie.secure,
            sameSite: refreshedCookie.sameSite as 'lax' | 'strict' | 'none',
            maxAge: refreshedCookie.maxAge,
          });
          return newResponse;
        }
      }
    } catch (error) {
      // Let the page render with the stale token — it will get a Strava API error
      // rather than crashing the proxy
      console.error(
        'Strava token refresh failed in proxy; continuing with existing session token',
        { path: request.nextUrl.pathname, error },
      );
    }
  }

  return response;
}

export const config = {
  matcher: ['/', '/activity/:path*'],
};
