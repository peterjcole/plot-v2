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
          console.info('[proxy] Token refreshed and propagated to request headers', {
            path: request.nextUrl.pathname,
            newExpiresAt: session.expiresAt,
          });
          return newResponse;
        } else {
          // session.save() ran but the refreshed cookie wasn't readable back from the
          // response — the server component will see the stale token and hit 401, which
          // will be caught by the page's error handler and routed to /api/auth/refresh.
          console.warn('[proxy] Token refreshed but could not read back cookie from response; server component may see stale token', {
            path: request.nextUrl.pathname,
          });
        }
      }
    } catch (error) {
      // Let the page render with the stale token — it will get a Strava API error
      // rather than crashing the proxy. The server component's 401 handler will
      // redirect to /api/auth/refresh if the token appears expired.
      console.error('[proxy] Strava token refresh failed; continuing with existing session token', {
        path: request.nextUrl.pathname,
        expiresAt: session.expiresAt,
        now: Math.floor(Date.now() / 1000),
        error,
      });
    }
  }

  return response;
}

export const config = {
  matcher: ['/', '/activity/:path*'],
};
