import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [
    Math.round(hue2rgb(h + 1 / 3) * 255),
    Math.round(hue2rgb(h) * 255),
    Math.round(hue2rgb(h - 1 / 3) * 255),
  ];
}

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

    const { data, info } = await sharp(Buffer.from(buffer))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const channels = info.channels; // 4 (RGBA)
    for (let i = 0; i < data.length; i += channels) {
      const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
      const lNew = Math.min(0.88, 1 - Math.pow(l, 0.8));
      const sNew = Math.min(1, s * 1.2);
      const [rNew, gNew, bNew] = hslToRgb(h, sNew, lNew);
      data[i] = rNew;
      data[i + 1] = gNew;
      data[i + 2] = bNew;
      // data[i + 3] alpha preserved
    }

    const processed = await sharp(data, {
      raw: { width: info.width, height: info.height, channels: info.channels },
    })
      .png()
      .toBuffer();

    return new NextResponse(new Uint8Array(processed), {
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
