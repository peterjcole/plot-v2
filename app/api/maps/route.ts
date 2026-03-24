import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { isOsTileInGB } from '@/lib/gb-tile-check';

let _transparent: Buffer | null = null;
async function transparentTile(): Promise<Buffer> {
  if (!_transparent) {
    _transparent = await sharp({
      create: { width: 256, height: 256, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).png().toBuffer();
  }
  return _transparent;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const xStr = searchParams.get('x');
  const yStr = searchParams.get('y');
  const zStr = searchParams.get('z');

  if (!xStr || !yStr || !zStr) {
    return NextResponse.json(
      { error: 'x, y, and z query parameters are required' },
      { status: 400 }
    );
  }

  const x = parseInt(xStr, 10);
  const y = parseInt(yStr, 10);
  const z = parseInt(zStr, 10);

  if (!isOsTileInGB(z, x, y)) {
    return new NextResponse(new Uint8Array(await transparentTile()), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=1209600, s-maxage=1209600',
      },
    });
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
        'Cache-Control': 'public, max-age=1209600, s-maxage=1209600',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch tile' },
      { status: 502 }
    );
  }
}
