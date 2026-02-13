import { NextResponse } from 'next/server';
import { getSession, backendFetch } from '@/lib/auth';

export async function GET() {
  const session = await getSession();

  if (!session.jwt) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const res = await backendFetch('/import/status', session.jwt);
  const data = await res.json();

  return NextResponse.json(data, { status: res.status });
}
