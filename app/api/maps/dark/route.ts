import { NextRequest, NextResponse } from 'next/server';
import { parseTileParams } from '@/lib/tile-params';
import sharp from 'sharp';
import { isOsTileInGB } from '@/lib/gb-tile-check';
import { applyDarkMode } from '@/lib/dark-tile';
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
    return Buffer.from(await applyDarkMode(await response.arrayBuffer()));
  } catch {
    return null;
  }
}

const CACHE = 'public, max-age=1209600, s-maxage=1209600';

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const tile = parseTileParams(sp);
  if (tile instanceof NextResponse) return tile;
  const { x, y, z } = tile;

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
