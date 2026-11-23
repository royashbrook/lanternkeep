import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
// the art runs to the edge of its tile, so a corner crop only ever eats sky. the maskable icon
// shrinks the art into the safe zone on the same night colour.
const svg = await readFile('public/icon.svg', 'utf8'), browser = await chromium.launch({ headless: true });
for (const size of [180, 192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<style>body{margin:0;background:#1d2a4d}svg{display:block;width:100%;height:100%}</style>${svg}`);
  await page.screenshot({ path: `public/icon-${size}.png` }); await page.close();
}
const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
await page.setContent(`<style>body{margin:0;background:#1d2a4d;display:grid;place-items:center;width:512px;height:512px}svg{display:block;width:410px;height:410px;border-radius:50%}</style>${svg}`);
await page.screenshot({ path: 'public/icon-maskable-512.png' });
await browser.close();
