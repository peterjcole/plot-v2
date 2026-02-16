import { NextResponse, NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';

async function logout(request: NextRequest) {
  const session = await getSession();
  session.destroy();

  return NextResponse.redirect(new URL('/', request.nextUrl.origin), 303);
}

export const GET = logout;
export const POST = logout;
