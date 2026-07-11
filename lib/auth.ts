import { getIronSession, SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';

export interface SessionData {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  athlete?: {
    id: number;
    firstname: string;
    lastname: string;
  };
  // Premium (backend-powered) feature access — resolved once at login by
  // calling the backend's athlete allowlist, then cached here so per-request
  // checks (e.g. tile requests) don't need to hit the backend. See lib/entitlements.ts.
  entitlements?: {
    premium: boolean;
  };
  oauthState?: string;
}

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error(
    'SESSION_SECRET env var is required and must be at least 32 characters',
  );
}

export const sessionOptions: SessionOptions = {
  password: sessionSecret,
  cookieName: 'plotv2_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
  },
};

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}
