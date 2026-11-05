/**
 * Renders the app icons (public/icons/*.png) from the AppMark glyph on a dawn sky.
 * Run once after changing the mark: `node scripts/make-icons.mjs`. Needs Playwright's Chromium.
 */
import { chromium } from "@playwright/test";

const mark = (stroke) => `
<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe3a3"/><stop offset="1" stop-color="#ff9d6c"/></linearGradient></defs>
  <path d="M7 19a9 9 0 0 1 18 0z" fill="url(#s)"/>
  <path d="M3 20.5c4-1.6 6.5-1.6 9.5 0s6.5 1.6 9.5 0 4.5-1.6 7 0" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M6 25c3-1 5-1 7.5 0s5 1 7.5 0 4-1 5 0" fill="none" stroke="${stroke}" stroke-opacity=".55" stroke-width="1.4" stroke-linecap="round"/>
</svg>`;

/** `inset`: share of the tile the mark may use (maskable icons keep to the 80% safe zone). */
const page = (size, inset, rounded) => `<!doctype html><html><body style="margin:0">
<div style="width:${size}px;height:${size}px;display:grid;place-items:center;border-radius:${rounded ? size * 0.22 : 0}px;
  background:linear-gradient(180deg,#3d6fb0 0%,#6aa4dc 55%,#f3c79a 100%);overflow:hidden">
  <div style="width:${size * inset}px;height:${size * inset}px">${mark("#ffffff")}</div>
</div></body></html>`;

const icons = [
  { file: "icon-192.png", size: 192, inset: 0.72, rounded: false },
  { file: "icon-512.png", size: 512, inset: 0.72, rounded: false },
  { file: "maskable-512.png", size: 512, inset: 0.56, rounded: false },
  { file: "apple-touch-icon.png", size: 180, inset: 0.7, rounded: false },
];

const browser = await chromium.launch();
for (const i of icons) {
  const p = await browser.newPage({ viewport: { width: i.size, height: i.size }, deviceScaleFactor: 1 });
  await p.setContent(page(i.size, i.inset, i.rounded));
  await p.locator("div").first().screenshot({ path: `public/icons/${i.file}`, omitBackground: true });
  await p.close();
}
await browser.close();
console.log(`Wrote ${icons.length} icons to public/icons/`);
