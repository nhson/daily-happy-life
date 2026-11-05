import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";
import { drizzle } from "drizzle-orm/neon-http";
import { readFile } from "node:fs/promises";
import * as schema from "../src/data/db/schema";
import { exportAll, importAll, type Export } from "../src/data/export";
import { at, c, hcmDate, seedSetUp, settled, sql } from "./support";

/**
 * Slice 8: Settings live on the account, and Export all is the whole account — proven by
 * restoring the downloaded file and getting the same export back.
 */
test.describe.serial("settings and export", () => {
  test("settings follow the account: reminder, timezone, evening, day end, theme", async ({ page }) => {
    await at(page, "10:00");
    const me = await seedSetUp(page, hcmDate(0));
    await page.goto("/settings");

    await page.getByLabel(c.settings.reminder).fill("06:45");
    await page.getByLabel(c.settings.evening).selectOption("20");
    await page.getByLabel(c.settings.dayEnds).selectOption("3");
    await page.getByLabel(c.settings.timeZone).selectOption("Asia/Bangkok");
    await page.getByRole("button", { name: c.settings.themes.dark }).click();

    await settled(async () => {
      const [u] = await sql()`select reminder_time, evening_hour, day_end_hour, timezone, theme from users where id = ${me}`;
      return u.reminder_time === "06:45" && u.evening_hour === 20 && u.day_end_hour === 3 && u.timezone === "Asia/Bangkok" && u.theme === "dark";
    });
    await page.reload();
    await expect(page.getByLabel(c.settings.reminder)).toHaveValue("06:45");
    await expect(page.getByLabel(c.settings.evening)).toHaveValue("20");
    await expect(page.getByLabel(c.settings.dayEnds)).toHaveValue("3");
    await expect(page.getByLabel(c.settings.timeZone)).toHaveValue("Asia/Bangkok");
    await expect(page.getByRole("button", { name: c.settings.themes.dark })).toHaveAttribute("aria-pressed", "true");
  });

  test("Export all downloads every table, and restoring it gives the same export back", async ({ page }) => {
    await at(page, "10:00");
    const me = await seedSetUp(page, hcmDate(0));
    // History beyond what the screen holds: a day closed months ago, a decision, a written plan.
    await sql()`insert into daily_logs (user_id, date, energy, engagement, meaning_sources, note, closed_at) values (${me}, '2026-03-14', 4, 5, '{flow,community}', 'Ngày dài, vui.', '2026-03-14T14:00:00Z')`;
    const [p2] = await sql()`update odyssey_plans set title = 'Mở một studio nhỏ', likability = 8 where user_id = ${me} and slot = 2 returning id`;
    await sql()`insert into decisions (user_id, date, decision, driven_by, linked_plan_id) values (${me}, ${hcmDate()}, 'Thử studio', 'Ba buổi cà phê.', ${p2.id})`;
    await page.goto("/settings");

    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: c.settings.export }).click()]);
    expect(download.suggestedFilename()).toMatch(/^daily-happy-life-\d{4}-\d{2}-\d{2}\.json$/);
    const file: Export = JSON.parse(await readFile((await download.path())!, "utf8"));

    expect(file.format).toBe("daily-happy-life");
    expect(file.compass?.workview).toBeTruthy();
    expect(file.odysseyPlans.map((p) => p.title)).toContain("Mở một studio nhỏ");
    expect(file.objectives.map((o) => o.title)).toEqual(["Ra mắt bản beta"]);
    expect(file.tasks).toHaveLength(2);
    expect(file.dailyLogs.map((l) => l.date)).toEqual(["2026-03-14", hcmDate()]);
    expect(file.decisions[0]).toMatchObject({ decision: "Thử studio", linkedPlanId: p2.id });
    expect(JSON.stringify(file)).not.toContain(me);

    // Round trip: lose some data, restore the file, export again.
    await sql()`delete from tasks where user_id = ${me}`;
    await sql()`delete from decisions where user_id = ${me}`;
    const db = drizzle({ client: neon(process.env.DATABASE_URL!), schema });
    await importAll(db as never, me, file);
    const again = await exportAll(db as never, me);
    expect({ ...again, exportedAt: "" }).toEqual({ ...file, exportedAt: "" });

    // And the app shows it again.
    await page.goto("/today");
    await expect(page.locator('section[aria-labelledby="top3-h"] [data-task]')).toHaveCount(2);
  });

  test("signed out, there is nothing to export", async ({ browser }) => {
    const ctx = await browser.newContext();
    const res = await ctx.request.get("/api/export", { maxRedirects: 0 });
    expect(res.status()).not.toBe(200);
    // No export in the body (a 404 page names the app in its title, so look for the export's own marker).
    expect(await res.text()).not.toContain('"format": "daily-happy-life"');
    await ctx.close();
  });
});
