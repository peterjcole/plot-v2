import { NextRequest, NextResponse } from 'next/server';

const ROUTE_ID_RE = /strava\.com\/routes\/(\d+)/i;

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'missing_url' }, { status: 400 });
  }

  let res: Response;
  try {
    // Follow redirects — Branch.io (strava.app.link) sends HTTP redirects for
    // non-mobile user agents, landing at the strava.com/routes/<id> web URL.
    res = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; plot-route-resolver)' },
    });
  } catch {
    return NextResponse.json({ error: 'network_error' }, { status: 502 });
  }

  // Try the final URL first (HTTP redirect case)
  const finalUrl = res.url;
  const urlMatch = finalUrl.match(ROUTE_ID_RE);
  if (urlMatch) {
    return NextResponse.json({ id: urlMatch[1] });
  }

  // Fallback: scan the response body for a strava.com/routes link
  // (handles JS-redirect pages that embed the destination URL in HTML)
  try {
    const text = await res.text();
    const bodyMatch = text.match(ROUTE_ID_RE);
    if (bodyMatch) {
      return NextResponse.json({ id: bodyMatch[1] });
    }
  } catch {
    // ignore body parse errors
  }

  return NextResponse.json({ error: 'not_resolved' }, { status: 422 });
}
