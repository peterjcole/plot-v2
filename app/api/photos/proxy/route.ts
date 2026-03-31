import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_HOSTS = ['.cloudfront.net', 'lh3.googleusercontent.com'];

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) return new NextResponse(null, { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const allowed = ALLOWED_HOSTS.some((h) =>
    parsed.hostname === h || parsed.hostname.endsWith(h)
  );
  if (!allowed) return new NextResponse(null, { status: 403 });

  try {
    const res = await fetch(url);
    if (!res.ok) return new NextResponse(null, { status: res.status });
    const body = await res.arrayBuffer();
    return new NextResponse(body, {
      headers: {
        'Content-Type': res.headers.get('Content-Type') ?? 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
