import { expect, test } from "@playwright/test";
import { at, c, hcmDate, seedSetUp, settled, sql } from "./support";

/**
 * Slice 12 (Phase 2 · Weekly Review): on Monday the card offers last week's review; opening it
 * stores the week's numbers (and the AI's notes when OPENROUTER_API_KEY is set), never the user's
 * notes; the takeaway is saved and the week then appears on the Life page.
 * The browser is pinned to the most recent Monday (never ahead of today: Clerk drops the session).
 */
const back = (new Date(`${hcmDate(0)}T00:00:00Z`).getUTCDay() + 6) % 7; // days since Monday
const MON = hcmDate(-back);
const SUN = hcmDate(-back - 1);
const TUE_BEFORE = hcmDate(-back - 6);

test.describe.serial("weekly review", () => {
  test.setTimeout(120_000);

  test("Monday: the card opens last week's review; the takeaway is kept; the Life page lists it", async ({ page }) => {
    await at(page, "10:00", -back);
    const me = await seedSetUp(page, hcmDate(-back - 8));
    const [t] = await sql()`select id from tasks where user_id = ${me} limit 1`;
    await sql()`update tasks set done_at = ${`${TUE_BEFORE}T10:00:00+07:00`} where id = ${t.id}`;
    // The week: one closed day with a private note; Sunday closed; Monday's ritual done.
    await sql()`insert into daily_logs (user_id, date, energy, engagement, meaning_sources, note, closed_at) values
      (${me}, ${TUE_BEFORE}, 2, 4, ${["flow"]}, 'NHẬT KÝ RIÊNG', ${`${TUE_BEFORE}T21:00:00+07:00`}),
      (${me}, ${SUN}, 4, 4, ${[]}, '', ${`${SUN}T21:00:00+07:00`})`;
    await sql()`insert into daily_logs (user_id, date, morning_at) values (${me}, ${MON}, now())`;
    await page.goto("/today");

    const card = page.getByRole("region", { name: c.weeklyReview.title });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: c.weeklyReview.open }).click();

    await expect(page.getByText(c.weeklyReview.done(1))).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText(c.weeklyReview.checkIns(2))).toBeVisible();
    await settled(async () => (await sql()`select 1 from weekly_reviews where user_id = ${me} and week_end = ${SUN}`).length === 1);
    const [row] = await sql()`select stats, notes from weekly_reviews where user_id = ${me} and week_end = ${SUN}`;
    expect(row.stats.done.total).toBe(1);
    expect(JSON.stringify(row)).not.toContain("NHẬT KÝ RIÊNG");
    if (row.notes) await expect(page.getByText(row.notes.observations[0])).toBeVisible();
    else await expect(page.getByText(c.weeklyReview.noNotes)).toBeVisible();

    await page.getByPlaceholder(c.weeklyReview.takeawayPlaceholder).fill("Giữ thứ Ba nhẹ hơn.");
    await page.getByRole("button", { name: c.weeklyReview.save, exact: true }).click();
    await settled(async () => (await sql()`select 1 from weekly_reviews where user_id = ${me} and takeaway = 'Giữ thứ Ba nhẹ hơn.'`).length === 1);

    // Opened once: the card is gone, the week is on the Life page.
    await page.reload();
    await expect(page.getByRole("heading", { name: c.today.top3 }).or(page.getByText(c.today.top3).first())).toBeVisible();
    await expect(page.getByRole("region", { name: c.weeklyReview.title })).toHaveCount(0);
    await page.goto("/life");
    const past = page.getByRole("region", { name: c.weeklyReview.past });
    await expect(past.getByText("Giữ thứ Ba nhẹ hơn.")).toBeVisible();
  });

  test("the AI's notes, when OpenRouter is configured", async ({ page }) => {
    test.skip(!process.env.OPENROUTER_API_KEY, "OPENROUTER_API_KEY not set");
    await at(page, "10:00", -back);
    const me = await seedSetUp(page, hcmDate(-back - 8));
    await sql()`insert into daily_logs (user_id, date, morning_at) values (${me}, ${MON}, now())`;
    await sql()`insert into daily_logs (user_id, date, closed_at) values (${me}, ${SUN}, now())`;
    await page.goto("/today");
    await page.getByRole("region", { name: c.weeklyReview.title }).getByRole("button", { name: c.weeklyReview.open }).click();
    await expect(page.getByText(c.weeklyReview.byAi)).toBeVisible({ timeout: 90_000 });
    const [row] = await sql()`select notes, model from weekly_reviews where user_id = ${me}`;
    expect(row.notes.observations.length).toBeGreaterThan(0);
    expect(row.model).toMatch(/free|gemma|nemotron/);
  });
});
