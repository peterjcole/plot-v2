import { NextResponse } from 'next/server';

export interface TileCoords {
  x: number;
  y: number;
  z: number;
}

// Parses the x/y/z query params shared by the tile proxy routes.
// Returns a 400 response for the caller to return when they're missing or invalid.
export function parseTileParams(sp: URLSearchParams): TileCoords | NextResponse {
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
    return NextResponse.json({ error: 'x, y, and z must be integers' }, { status: 400 });
  }

  return { x, y, z };
}
