import sharp from 'sharp';

let _transparent256: Buffer | null = null;
async function transparent256(): Promise<Buffer> {
  if (!_transparent256) {
    _transparent256 = await sharp({
      create: { width: 256, height: 256, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).png().toBuffer();
  }
  return _transparent256;
}

/**
 * Fetches the 4 child tiles at z+1 for a given (z, x, y) tile and composites
 * them into a single 512×512 PNG — suitable for retina (@2x) display when
 * paired with tilePixelRatio: 2 on the OpenLayers XYZ source.
 *
 * Child layout for (z, x, y):
 *   TL = (z+1, 2x,   2y)     TR = (z+1, 2x+1, 2y)
 *   BL = (z+1, 2x,   2y+1)   BR = (z+1, 2x+1, 2y+1)
 *
 * fetchTile should return null for tiles that are unavailable or out-of-bounds;
 * those quadrants are filled with transparency.
 */
export async function stitchRetinaTile(
  fetchTile: (z: number, x: number, y: number) => Promise<Buffer | null>,
  z: number,
  x: number,
  y: number,
): Promise<Buffer> {
  const [tl, tr, bl, br] = await Promise.all([
    fetchTile(z + 1, 2 * x,     2 * y),
    fetchTile(z + 1, 2 * x + 1, 2 * y),
    fetchTile(z + 1, 2 * x,     2 * y + 1),
    fetchTile(z + 1, 2 * x + 1, 2 * y + 1),
  ]);

  const fallback = await transparent256();

  return sharp({
    create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: tl ?? fallback, top: 0,   left: 0   },
      { input: tr ?? fallback, top: 0,   left: 256 },
      { input: bl ?? fallback, top: 256, left: 0   },
      { input: br ?? fallback, top: 256, left: 256 },
    ])
    .png()
    .toBuffer();
}
