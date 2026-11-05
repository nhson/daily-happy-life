// Frame timing of a page load and of tab switches at phone size with a slowed CPU.
// Usage: node scripts/perf-nav.mjs [baseUrl]   (needs `bun run dev:review` or a review build running)
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:3210";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const cdp = await page.context().newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

const watch = () =>
  page.evaluate(() => {
    const w = window;
    w.__frames = [];
    let last = performance.now();
    const tick = (t) => {
      w.__frames.push(t - last);
      last = t;
      if (w.__frames.length < 400) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
const report = async (label, ms) => {
  await page.waitForTimeout(ms);
  const f = await page.evaluate(() => window.__frames);
  const total = f.reduce((a, b) => a + b, 0);
  const janky = f.filter((x) => x > 34).length;
  console.log(`${label.padEnd(22)} frames ${String(f.length).padStart(3)}  janky(>34ms) ${String(janky).padStart(3)}  worst ${Math.round(Math.max(...f))}ms  avg fps ${Math.round((f.length / total) * 1000)}`);
};

const t0 = Date.now();
await page.goto(`${base}/today?at=11:30`);
const skip = page.getByRole("button", { name: "Bỏ qua hôm nay" });
if (await skip.isVisible().catch(() => false)) await skip.click();
await page.waitForSelector("[data-task]");
console.log(`load → first task       ${Date.now() - t0}ms`);
await watch();
await report("after load (1.5s)", 1500);

for (const tab of ["Việc", "Cuộc sống", "Hôm nay", "Việc", "Hôm nay"]) {
  await page.waitForTimeout(800);
  await watch();
  await page.locator("nav").last().getByRole("link", { name: tab }).click();
  await report(`→ ${tab}`, 1200);
}
await browser.close();
