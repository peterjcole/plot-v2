import { getIronSession, SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';

export interface SessionData {
  jwt?: string;
  athlete?: {
    id: number;
    firstname: string;
    lastname: string;
  };
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

const BACKEND_URL = process.env.HEATMAP_BACKEND_URL;

/**
 * Make an authenticated request to the backend API.
 * Returns null if not authenticated.
 */
export async function backendFetch(path: string, jwt: string, init?: RequestInit): Promise<Response> {
  if (!BACKEND_URL) {
    throw new Error('HEATMAP_BACKEND_URL is not configured');
  }

  return fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${jwt}`,
    },
  });
}
