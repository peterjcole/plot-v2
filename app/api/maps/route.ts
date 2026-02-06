import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const x = searchParams.get('x');
  const y = searchParams.get('y');
  const z = searchParams.get('z');

  if (!x || !y || !z) {
    return NextResponse.json(
      { error: 'x, y, and z query parameters are required' },
      { status: 400 }
    );
  }

  const apiKey = process.env.OS_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OS Maps API key not configured' },
      { status: 500 }
    );
  }

  const tileUrl = `https://api.os.uk/maps/raster/v1/zxy/Leisure_27700/${z}/${x}/${y}.png?key=${apiKey}`;

  try {
    const response = await fetch(tileUrl);

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
      { error: 'Failed to fetch tile' },
      { status: 502 }
    );
  }
}
