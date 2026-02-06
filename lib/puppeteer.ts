import type { Browser } from 'puppeteer-core';

let cachedBrowser: Browser | null = null;

const isDev = process.env.NODE_ENV === 'development';

export async function getBrowser(): Promise<Browser> {
  if (cachedBrowser) {
    return cachedBrowser;
  }

  if (isDev) {
    const puppeteer = await import('puppeteer');
    cachedBrowser = await puppeteer.default.launch({
      defaultViewport: { width: 1200, height: 630 },
      headless: true,
    });
  } else {
    const puppeteerCore = await import('puppeteer-core');
    const chromium = await import('@sparticuz/chromium');

    cachedBrowser = await puppeteerCore.default.launch({
      args: chromium.default.args,
      defaultViewport: { width: 1200, height: 630 },
      executablePath: await chromium.default.executablePath(),
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
