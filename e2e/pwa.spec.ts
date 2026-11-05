import { expect, test } from "@playwright/test";
import { at, c, hcmDate, seedSetUp, settled, sql } from "./support";

/**
 * Slice 9 (the parts that need no outside service): installable app, Today opening offline from
 * the service worker, capture keeping its draft offline, and the reminder endpoint refusing calls
 * that QStash didn't sign. Push delivery itself is checked on the owner's iPhone.
 */
test.describe.serial("installable app", () => {
  test("a manifest with icons, and a service worker that is always fresh", async ({ request }) => {
    const m = await request.get("/manifest.webmanifest");
    expect(m.ok()).toBe(true);
    const manifest = await m.json();
    expect(manifest).toMatchObject({ start_url: "/today", display: "standalone" });
    for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
    expect((await request.get("/icons/apple-touch-icon.png")).ok()).toBe(true);

    const sw = await request.get("/sw.js");
    expect(sw.ok()).toBe(true);
    expect(sw.headers()["cache-control"]).toContain("no-store");
  });

  test("Chromium finds nothing in the way of installing it", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "CDP");
    await at(page, "10:00");
    await seedSetUp(page, hcmDate(0));
    await page.goto("/today");
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    const cdp = await page.context().newCDPSession(page);
    const { installabilityErrors } = (await cdp.send("Page.getInstallabilityErrors")) as { installabilityErrors: { errorId: string }[] };
    expect(installabilityErrors.map((e) => e.errorId)).toEqual([]);
  });

  test("Today opens offline; capture keeps its draft until the connection is back", async ({ page, context }) => {
    await at(page, "10:00");
    const me = await seedSetUp(page, hcmDate(0));
    await page.goto("/today");
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.reload(); // now controlled: this visit is kept for offline
    await expect(page.locator('section[aria-labelledby="top3-h"] [data-task]')).toHaveCount(2);

    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('section[aria-labelledby="top3-h"] [data-task]')).toHaveCount(2);

    await page.getByRole("button", { name: `${c.capture.open} (⌘K)` }).first().click();
    const input = page.getByPlaceholder(c.capture.placeholder);
    await input.fill("Gọi cho mẹ");
    await input.press("Enter");
    await expect(page.getByRole("alert").filter({ hasText: c.capture.offline })).toBeVisible();
    await expect(input).toHaveValue("Gọi cho mẹ");
    expect(await sql()`select 1 from tasks where user_id = ${me} and title = 'Gọi cho mẹ'`).toHaveLength(0);

    await context.setOffline(false);
    await page.reload();
    await page.getByRole("button", { name: `${c.capture.open} (⌘K)` }).first().click();
    await expect(page.getByPlaceholder(c.capture.placeholder)).toHaveValue("Gọi cho mẹ");
    await page.getByPlaceholder(c.capture.placeholder).press("Enter");
    await expect(page.getByText(c.capture.added(1))).toBeVisible();
    await settled(async () => (await sql()`select 1 from tasks where user_id = ${me} and title = 'Gọi cho mẹ'`).length === 1);
  });

  test("the reminder endpoint only answers QStash", async ({ request }) => {
    const res = await request.post("/api/remind", { data: { userId: "00000000-0000-0000-0000-000000000000" }, maxRedirects: 0 });
    // 401 (bad signature) once reminders are configured, 503 before; never a sign-in redirect or a send.
    expect([401, 503]).toContain(res.status());
  });
});
