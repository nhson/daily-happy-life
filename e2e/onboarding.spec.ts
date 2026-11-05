import { expect, test, type Browser, type Page } from "@playwright/test";
import { at, c, hcmDate, seedSetUp, settled, signIn, sql } from "./support";

/**
 * Slice 5: after Day 1 setup, the one-time cards on Today (tip → reminder ask → Odyssey nudge)
 * follow the user across devices. A second device is a fresh browser context: no shared storage,
 * only the server.
 */
const onboarding = async (me: string) => (await sql()`select onboarding from users where id = ${me}`)[0].onboarding;

async function otherDevice(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ storageState: undefined });
  const page = await ctx.newPage();
  await at(page, "10:00");
  await signIn(page);
  await page.goto("/today");
  await expect(page.locator('section[aria-labelledby="top3-h"]')).toBeVisible();
  return page;
}

test.describe.serial("first run follows you", () => {
  test("a tip dismissed on the phone stays dismissed on the laptop", async ({ page, browser }) => {
    await at(page, "10:00");
    const me = await seedSetUp(page, hcmDate(0));
    await page.goto("/today");

    const tip = page.getByRole("note").filter({ hasText: c.tips.top3 });
    await expect(tip).toBeVisible();
    await tip.getByRole("button", { name: c.tips.gotIt }).click();
    await expect(tip).toHaveCount(0);
    await settled(async () => (await onboarding(me)).seenTips.includes("top3"));

    const laptop = await otherDevice(browser);
    await expect(laptop.getByText(c.tips.top3)).toHaveCount(0);
    // Meanwhile the laptop dismisses another tip; the phone's earlier one must survive it.
    await laptop.goto("/life");
    const lifeTip = laptop.getByRole("note").filter({ hasText: c.tips.life });
    await expect(lifeTip).toBeVisible();
    await lifeTip.getByRole("button", { name: c.tips.gotIt }).click();
    await settled(async () => (await onboarding(me)).seenTips.includes("life"));
    expect((await onboarding(me)).seenTips).toEqual(expect.arrayContaining(["top3", "life"]));
    await laptop.context().close();
  });

  test("after the first closed day: the reminder ask once, then the Odyssey nudge; Not now holds on every device", async ({ page, browser }) => {
    await at(page, "10:00");
    const me = await seedSetUp(page, hcmDate(-1));
    // Day 1 was closed; today is day 2, no Top 3 yet.
    await sql()`update daily_logs set closed_at = now() where user_id = ${me} and date = ${hcmDate(-1)}`;
    await page.goto("/today");
    const ritual = page.locator(`[aria-label="${c.today.ritual}"]`);
    if (await ritual.isVisible()) await page.getByRole("button", { name: c.morning.skip }).click();

    const ask = page.getByRole("region", { name: c.onboarding.reminderTitle });
    await expect(ask).toBeVisible();
    await ask.getByRole("button", { name: c.onboarding.reminderNo }).click();
    await settled(async () => (await onboarding(me)).reminderAskedAt !== null);

    // One card at a time: the nudge for Plan 1 comes next.
    const nudge = page.getByRole("region", { name: c.onboarding.nudgeEyebrow(1) });
    await expect(nudge).toBeVisible();
    await nudge.getByRole("button", { name: c.onboarding.nudgeLater }).click();
    await expect(nudge).toHaveCount(0);
    await settled(async () => (await onboarding(me)).nudges?.["1"]?.notNowCount === 1);
    expect((await onboarding(me)).nudges["1"].snoozedUntil).toBe(hcmDate(2)); // two days

    const laptop = await otherDevice(browser);
    await expect(laptop.getByRole("region", { name: c.onboarding.reminderTitle })).toHaveCount(0);
    await expect(laptop.getByRole("region", { name: c.onboarding.nudgeEyebrow(1) })).toHaveCount(0);
    await laptop.context().close();
  });

  test("Show tips again brings them back everywhere", async ({ page, browser }) => {
    await at(page, "10:00");
    await signIn(page);
    await page.goto("/settings");
    await page.getByRole("button", { name: c.settings.showTips }).click();
    await expect(page.getByText(c.settings.tipsShown)).toBeVisible();

    const laptop = await otherDevice(browser);
    await laptop.goto("/life");
    await expect(laptop.getByRole("note").filter({ hasText: c.tips.life })).toBeVisible();
    await laptop.context().close();
  });
});
