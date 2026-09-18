import { NextRequest, NextResponse } from 'next/server';

// Deliberately public — no auth, no session check, nothing from
// `@/lib/mobile-auth`. The share token in the URL *is* the credential (an
// unguessable 128-bit link, per design); plot-backend's GET /b/:token is
// itself unauthenticated for the same reason, so this is a plain
// pass-through, not a security boundary of its own. Exists only so the
// tracking page (app/(main)/beacon/[token]/page.tsx) can call same-origin
// (no CORS needed on the worker) — same rationale as the existing
// same-origin tile proxies in lib/map-config.ts.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const backendUrl = process.env.TILES_BACKEND_URL;
  if (!backendUrl) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }

  try {
    const res = await fetch(`${backendUrl}/b/${encodeURIComponent(token)}`, {
      // Every poll needs the latest pings — an intermediate cache serving a
      // stale snapshot would silently undermine the page's own "last
      // updated" staleness indicator.
      cache: 'no-store',
    });
    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
