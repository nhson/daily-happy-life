import { expect, test } from "@playwright/test";
import { at, c, hcmDate, seedSetUp, settled, sql } from "./support";

/**
 * Slice 4: the Evening Check-in lands on the Logical Day (00:40 is still yesterday), and a
 * missed check-in is offered once the next morning — reflection only — and counts toward the dots.
 * Each test sets up its own account in the past: the browser clock never moves more than a day
 * ahead (further, and Clerk drops the session).
 */
test.describe.serial("evening check-in", () => {
  const D0 = hcmDate(0);

  test("a check-in at 00:40 lands on the day before", async ({ page }) => {
    await at(page, "00:40", 1);
    const me = await seedSetUp(page, hcmDate(-1));
    await page.goto("/today");

    // Evening mode until 04:00: the sheet rises by itself.
    await expect(page.getByRole("heading", { name: c.checkIn.title })).toBeVisible();
    await page.getByRole("radio", { name: c.common.rating(c.checkIn.energy, 4, 5) }).click();
    await page.getByRole("radio", { name: c.common.rating(c.checkIn.engagement, 3, 5) }).click();
    await page.getByRole("button", { name: `${c.meaning.flow.name}: ${c.meaning.flow.hint}` }).click();
    await page.getByPlaceholder(c.checkIn.notePlaceholder).fill("Về muộn nhưng vui.");
    await page.getByRole("button", { name: c.checkIn.close, exact: true }).last().click();
    await expect(page.getByText(c.today.dayClosed)).toBeVisible();

    await settled(async () => (await sql()`select 1 from daily_logs where user_id = ${me} and date = ${D0} and closed_at is not null`).length === 1);
    const [log] = await sql()`select energy, engagement, meaning_sources, note from daily_logs where user_id = ${me} and date = ${D0}`;
    expect(log).toEqual({ energy: 4, engagement: 3, meaning_sources: ["flow"], note: "Về muộn nhưng vui." });
    expect(await sql()`select 1 from daily_logs where user_id = ${me} and date = ${hcmDate(1)}`).toHaveLength(0);
  });

  test("the morning offers to close a missed yesterday, which then counts toward the dots", async ({ page }) => {
    await at(page, "07:30");
    const me = await seedSetUp(page, hcmDate(-2));
    // The setup day was closed; yesterday was not.
    await sql()`update daily_logs set closed_at = now() where user_id = ${me} and date = ${hcmDate(-2)}`;
    await page.goto("/today");

    await expect(page.getByRole("heading", { name: c.yesterday.title })).toBeVisible();
    await page.getByRole("radio", { name: c.common.rating(c.checkIn.energy, 2, 5) }).click();
    await page.getByRole("button", { name: `${c.meaning.community.name}: ${c.meaning.community.hint}` }).click();
    await page.getByRole("button", { name: c.yesterday.save }).click();

    // On to the normal ritual; no task ticking happened.
    await expect(page.getByRole("button", { name: c.morning.begin })).toBeVisible();
    await settled(async () => (await sql()`select 1 from daily_logs where user_id = ${me} and date = ${hcmDate(-1)} and closed_at is not null`).length === 1);
    const [log] = await sql()`select energy, meaning_sources from daily_logs where user_id = ${me} and date = ${hcmDate(-1)}`;
    expect(log).toEqual({ energy: 2, meaning_sources: ["community"] });
    expect(await sql()`select 1 from tasks where user_id = ${me} and done_at is not null`).toHaveLength(0);

    await page.getByRole("button", { name: c.morning.skip }).click();
    // Two closed days in the last seven: the setup day and yesterday, closed this morning.
    await expect(page.getByText(c.today.weekLabel(2))).toBeVisible();
  });

  test("skipped, it isn't offered again — not even when the ritual is opened by hand", async ({ page }) => {
    await at(page, "07:30");
    const me = await seedSetUp(page, hcmDate(-2));
    await page.goto("/today");

    await expect(page.getByRole("heading", { name: c.yesterday.title })).toBeVisible();
    await page.getByRole("button", { name: c.yesterday.skip, exact: true }).click();
    await expect(page.getByRole("button", { name: c.morning.begin })).toBeVisible();
    await page.getByRole("button", { name: c.morning.skip }).click();
    await settled(async () => (await sql()`select 1 from daily_logs where user_id = ${me} and date = ${D0} and morning_at is not null`).length === 1);

    await page.reload();
    await page.getByRole("button", { name: c.today.ritual }).click();
    await expect(page.getByRole("button", { name: c.morning.begin })).toBeVisible();
    await expect(page.getByRole("heading", { name: c.yesterday.title })).toHaveCount(0);
    expect(await sql()`select 1 from daily_logs where user_id = ${me} and date = ${hcmDate(-1)} and closed_at is not null`).toHaveLength(0);
  });
});
