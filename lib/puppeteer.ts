import type { Browser } from 'puppeteer-core';

let cachedBrowser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (cachedBrowser) {
    return cachedBrowser;
  }

  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    // Development: use full puppeteer with bundled Chromium
    const puppeteer = await import('puppeteer');
    cachedBrowser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  } else {
    // Production: use puppeteer-core with external Chromium
    const puppeteerCore = await import('puppeteer-core');
    const chromium = await import('@sparticuz/chromium-min');

    cachedBrowser = await puppeteerCore.default.launch({
      args: chromium.default.args,
      defaultViewport: { width: 1200, height: 630 },
      executablePath: await chromium.default.executablePath(
        'https://github.com/nickarellano/chromium/raw/refs/heads/main/chromium-v130.0.1-pack.tar'
      ),
      headless: true,
    });
  }

  return cachedBrowser;
}

export async function closeBrowser(): Promise<void> {
  if (cachedBrowser) {
    await cachedBrowser.close();
    cachedBrowser = null;
  }
}
