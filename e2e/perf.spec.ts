import { expect, test, type Page } from "@playwright/test";
import { at, c, hcmDate, seedSetUp, signIn, top3Rows } from "./support";

/**
 * Slice 10: the PLAN perf budget on a "mid phone, 4G" — Lighthouse's mobile profile: 150 ms RTT,
 * 1.6 Mbps down, 750 kbps up, CPU 4× slower. Chromium only (CDP). Run against production:
 * E2E_BASE_URL=https://daily-happy-life.vercel.app bunx playwright test e2e/perf.spec.ts
 */
const BUDGET = { interactive: 1500, inp: 100 };

async function throttle(page: Page, cache: boolean) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: !cache });
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
}

/** From navigation to the first tap on capture that opens the sheet (so hydration counts). */
async function timeToInteractive(page: Page): Promise<{ content: number; interactive: number }> {
  const t0 = Date.now();
  await page.goto("/today", { waitUntil: "commit" });
  await expect(top3Rows(page).first()).toBeVisible({ timeout: 20_000 });
  const content = Date.now() - t0;
  const open = page.getByRole("button", { name: `${c.capture.open} (⌘K)` }).first();
  const sheet = page.getByPlaceholder(c.capture.placeholder);
  for (let i = 0; i < 200 && !(await sheet.isVisible()); i++) {
    await open.click({ timeout: 5000 }).catch(() => {});
    if (!(await sheet.isVisible())) await page.waitForTimeout(50);
  }
  await expect(sheet).toBeVisible();
  return { content, interactive: Date.now() - t0 };
}

test.describe.serial("performance budget", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "CDP throttling");

  test("Today is interactive within 1.5 s on a mid phone over 4G", async ({ page }) => {
    await at(page, "10:00");
    await seedSetUp(page, hcmDate(0));
    await page.goto("/today");
    await expect(top3Rows(page).first()).toBeVisible();
    await page.waitForTimeout(1500); // service worker installed, like a phone that opened the app before

    await throttle(page, false);
    const cold = await timeToInteractive(page);
    await throttle(page, true);
    const warm = await timeToInteractive(page);
    console.log(`cold (no cache): content ${cold.content} ms, interactive ${cold.interactive} ms`);
    console.log(`repeat visit:    content ${warm.content} ms, interactive ${warm.interactive} ms`);
    test.info().annotations.push({ type: "perf", description: JSON.stringify({ cold, warm }) });
    expect(warm.interactive).toBeLessThan(BUDGET.interactive);
  });

  test("every tap answers within 100 ms (INP) with the CPU 4× slower", async ({ page }) => {
    await at(page, "10:00");
    await signIn(page);
    await page.goto("/today");
    await expect(top3Rows(page).first()).toBeVisible();
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      (window as unknown as { __ev: number[] }).__ev = [];
      new PerformanceObserver((l) => {
        // interactionId: Event Timing Level 2, not yet in the DOM types.
        for (const e of l.getEntries() as (PerformanceEventTiming & { interactionId?: number })[]) if (e.interactionId) (window as unknown as { __ev: number[] }).__ev.push(e.duration);
      }).observe({ type: "event", durationThreshold: 16, buffered: true } as PerformanceObserverInit);
    });
    await throttle(page, true);

    const row = top3Rows(page).first();
    await row.getByRole("button", { name: c.taskRow.removeTop3 }).click(); // star off
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: `${c.capture.open} (⌘K)` }).first().click();
    await page.waitForTimeout(400);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    await page.getByRole("link", { name: c.tabs.tasks }).first().click();
    await page.waitForTimeout(800);
    await page.getByRole("link", { name: c.tabs.today }).first().click();
    await page.waitForTimeout(800);
    await top3Rows(page).first().locator("button").first().click(); // complete
    await page.waitForTimeout(800);

    const durations: number[] = await page.evaluate(() => (window as unknown as { __ev: number[] }).__ev);
    const inp = Math.max(0, ...durations);
    console.log(`interactions: ${durations.length}, slowest ${inp} ms (all: ${durations.join(", ")})`);
    expect(inp).toBeLessThan(BUDGET.inp);
  });
});
