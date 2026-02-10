import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sport = searchParams.get('sport');
  const color = searchParams.get('color');
  const z = searchParams.get('z');
  const x = searchParams.get('x');
  const y = searchParams.get('y');

  if (!sport || !color || !z || !x || !y) {
    return NextResponse.json(
      { error: 'sport, color, z, x, and y query parameters are required' },
      { status: 400 }
    );
  }

  const baseUrl = process.env.HEATMAP_BASE_URL;
  const token = process.env.HEATMAP_BEARER_TOKEN;
  if (!baseUrl || !token) {
    return NextResponse.json(
      { error: 'Heatmap service not configured' },
      { status: 500 }
    );
  }

  const tileUrl = `${baseUrl}${sport}/${color}/${z}/${x}/${y}.png`;

  try {
    const response = await fetch(tileUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      return new NextResponse(null, { status: response.status });
    }

    const buffer = await response.arrayBuffer();

    return new NextResponse(Buffer.from(buffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch heatmap tile' },
      { status: 502 }
    );
  }
}
