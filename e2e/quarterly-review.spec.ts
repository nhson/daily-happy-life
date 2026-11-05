import { expect, test } from "@playwright/test";
import { at, c, hcmDate, seedSetUp, settled, sql } from "./support";

/**
 * Slice 13: Quarterly Review. A user who lived through last quarter gets it at the start of this
 * one even with nothing left to settle; it is saved step by step (a reload resumes), re-rated
 * Gauges and a plan switch are kept with it, and the finished quarter is listed on Life.
 */
const thisQuarter = () => `${hcmDate().slice(0, 4)}-Q${Math.ceil(Number(hcmDate().slice(5, 7)) / 3)}`;
const lastQuarter = () => {
  const [y, q] = thisQuarter().split("-Q").map(Number);
  return q === 1 ? `${y - 1}-Q4` : `${y}-Q${q - 1}`;
};
const label = (q: string) => q.replace(/^(\d{4})-(Q\d)$/, "$2 · $1");
const CURRENT = "Dẫn dắt sản phẩm AI, đội ngũ bình tâm";
const STUDIO = "Studio độc lập, ứng dụng nhỏ hữu ích";

test("no leftovers: dashboard → (reload resumes) → re-rate + switch plan → done; kept and listed on Life", async ({ page }) => {
  await at(page, "10:00");
  // Set up last quarter, its Objective already finished: nothing to settle.
  const me = await seedSetUp(page, hcmDate(-100));
  await sql()`update objectives set status = 'done' where user_id = ${me}`;
  await sql()`insert into daily_logs (user_id, date, morning_at) values (${me}, ${hcmDate(0)}, now())`;
  await sql()`update odyssey_plans set title = ${CURRENT}, resources = 7, likability = 6, confidence = 7, coherence = 8 where user_id = ${me} and slot = 1`;
  await sql()`update odyssey_plans set title = ${STUDIO}, resources = 4, likability = 8, confidence = 5, coherence = 7 where user_id = ${me} and slot = 2`;
  const [studio] = await sql()`select id from odyssey_plans where user_id = ${me} and slot = 2`;
  await page.goto("/today");

  const card = page.getByRole("region", { name: c.quarterReview.eyebrow(label(lastQuarter())) });
  await expect(card.getByText(c.quarterReview.dashboardTitle)).toBeVisible();
  await expect(page.locator('section[aria-labelledby="top3-h"]')).toBeVisible(); // never blocking
  await card.getByRole("slider").nth(0).fill("8"); // Health
  await card.getByRole("slider").nth(2).fill("3"); // Play
  await card.screenshot({ path: test.info().outputPath("dashboard.png") });
  await card.getByRole("button", { name: c.quarterReview.next, exact: true }).click();
  await expect(card.getByText(c.quarterReview.plansTitle)).toBeVisible();
  await settled(async () => (await sql()`select 1 from quarterly_reviews where user_id = ${me} and health = 8 and play = 3`).length === 1);

  // A reload picks up at the plans.
  await page.reload();
  await expect(card.getByText(c.quarterReview.plansTitle)).toBeVisible();
  const plan2 = card.getByRole("group", { name: STUDIO });
  await plan2.getByRole("button", { name: c.quarterReview.rerate }).click();
  await plan2.getByRole("slider").nth(1).fill("10"); // Likability
  await card.screenshot({ path: test.info().outputPath("plans.png") });

  // Switch through the same sheet as on Life; it offers its own Decision.
  await plan2.getByRole("button", { name: c.quarterReview.switchTo }).click();
  const sheet = page.getByRole("dialog", { name: c.life.changeActive });
  await sheet.getByRole("button", { name: c.promotion.confirm }).click();
  await sheet.getByRole("button", { name: c.promotion.skipDecision }).click();
  await expect(sheet).toHaveCount(0);
  await card.getByRole("button", { name: c.quarterReview.next, exact: true }).click();

  // No second Decision question after a switch: straight to "add one?" (this quarter has none).
  await expect(card.getByText(c.quarterClose.decisionQ)).toHaveCount(0);
  await expect(card.getByText(c.quarterClose.addOneQ(0))).toBeVisible();
  await card.getByRole("button", { name: c.quarterClose.later }).click();
  await expect(card).toHaveCount(0);

  await settled(async () => (await sql()`select 1 from quarterly_reviews where user_id = ${me} and completed_at is not null`).length === 1);
  const [r] = await sql()`select health, work, play, love, plans, active_plan_id from quarterly_reviews where user_id = ${me} and quarter = ${lastQuarter()}`;
  expect(r).toMatchObject({ health: 8, work: 5, play: 3, love: 5, active_plan_id: studio.id });
  expect(r.plans.map((p: { slot: number; gauges: { likability: number } }) => [p.slot, p.gauges.likability])).toEqual([
    [1, 6],
    [2, 10],
  ]);
  const [p2] = await sql()`select likability, is_active from odyssey_plans where id = ${studio.id}`;
  expect(p2).toEqual({ likability: 10, is_active: true });

  // Listed on Life; gone from Today for good.
  await page.goto("/life");
  const past = page.getByRole("region", { name: c.quarterReview.pastTitle });
  await expect(past.getByRole("listitem", { name: label(lastQuarter()) })).toContainText(c.quarterReview.onPlan(STUDIO));
  await past.screenshot({ path: test.info().outputPath("life.png") });
  await page.goto("/today");
  await expect(page.locator('section[aria-labelledby="top3-h"]')).toBeVisible();
  await expect(page.getByText(c.quarterReview.dashboardTitle)).toHaveCount(0);
});

test("a user set up this quarter isn't asked", async ({ page }) => {
  await at(page, "10:00");
  await seedSetUp(page, hcmDate(0));
  await page.goto("/today");
  await expect(page.locator('section[aria-labelledby="top3-h"]')).toBeVisible();
  await expect(page.getByText(c.quarterReview.dashboardTitle)).toHaveCount(0);
});
