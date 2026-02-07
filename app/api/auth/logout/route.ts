import { NextResponse, NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const session = await getSession();
  session.destroy();

  return NextResponse.redirect(new URL('/', request.nextUrl.origin), 303);
}
