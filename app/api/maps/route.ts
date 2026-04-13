import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { isOsTileInGB } from '@/lib/gb-tile-check';
import { stitchRetinaTile } from '@/lib/tile-stitch';

let _transparent: Buffer | null = null;
async function transparentTile(): Promise<Buffer> {
  if (!_transparent) {
    _transparent = await sharp({
      create: { width: 256, height: 256, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).png().toBuffer();
  }
  return _transparent;
}

async function fetchTileBuffer(z: number, x: number, y: number): Promise<Buffer | null> {
  if (!isOsTileInGB(z, x, y)) return transparentTile();

  const apiKey = process.env.OS_MAPS_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://api.os.uk/maps/raster/v1/zxy/Leisure_27700/${z}/${x}/${y}.png?key=${apiKey}`
    );
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

const CACHE = 'public, max-age=1209600, s-maxage=1209600';

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const xStr = sp.get('x');
  const yStr = sp.get('y');
  const zStr = sp.get('z');

  if (!xStr || !yStr || !zStr) {
    return NextResponse.json({ error: 'x, y, and z query parameters are required' }, { status: 400 });
  }

  const x = parseInt(xStr, 10);
  const y = parseInt(yStr, 10);
  const z = parseInt(zStr, 10);

  if (isNaN(x) || isNaN(y) || isNaN(z)) {
    return NextResponse.json({ error: 'x, y, z must be integers' }, { status: 400 });
  }

  if (sp.get('scale') === '2') {
    const buf = await stitchRetinaTile(fetchTileBuffer, z, x, y);
    return new NextResponse(new Uint8Array(buf), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': CACHE },
    });
  }

  const buf = await fetchTileBuffer(z, x, y);
  if (!buf) return new NextResponse(null, { status: 502 });

  return new NextResponse(new Uint8Array(buf), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': CACHE },
  });
}
