import type { Browser } from 'puppeteer-core';

let cachedBrowser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (cachedBrowser) {
    return cachedBrowser;
  }

  const puppeteerCore = await import('puppeteer-core');
  const chromium = await import('@sparticuz/chromium');

  cachedBrowser = await puppeteerCore.default.launch({
    args: chromium.default.args,
    defaultViewport: { width: 1200, height: 630 },
    executablePath: await chromium.default.executablePath(),
    headless: true,
  });

  return cachedBrowser;
}

export async function closeBrowser(): Promise<void> {
  if (cachedBrowser) {
    await cachedBrowser.close();
    cachedBrowser = null;
  }
}
