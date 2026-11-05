import { expect, test } from "@playwright/test";
import { at, c, hcmDate, seedSetUp, settled, sql } from "./support";

/**
 * Slice 7: Quarter Close. Last quarter's still-active Objectives get Done / Drop / Carry forward
 * from a card on Today that never blocks the day, and stay usable until then. Seeded as Q3
 * leftovers while today is in Q4 (the same boundary as 1 January; the domain test covers that date).
 */
const thisQuarter = () => `${hcmDate().slice(0, 4)}-Q${Math.ceil(Number(hcmDate().slice(5, 7)) / 3)}`;
const lastQuarter = () => {
  const [y, q] = thisQuarter().split("-Q").map(Number);
  return q === 1 ? `${y - 1}-Q4` : `${y}-Q${q - 1}`;
};

test("leftovers stay usable, then each gets Done / Drop / Carry forward; it ends with a Decision and “add one?”", async ({ page }) => {
  await at(page, "10:00");
  const me = await seedSetUp(page, hcmDate(0));
  const [p1] = await sql()`select id from odyssey_plans where user_id = ${me} and slot = 1`;
  const [blog] = await sql()`insert into objectives (user_id, plan_id, title, quarter) values (${me}, ${p1.id}, 'Viết blog đều', ${lastQuarter()}) returning id`;
  const [jp] = await sql()`insert into objectives (user_id, plan_id, title, quarter) values (${me}, ${p1.id}, 'Học tiếng Nhật', ${lastQuarter()}) returning id`;
  await sql()`insert into tasks (user_id, kind, objective_id, title) values (${me}, 'objective', ${blog.id}, 'Bài về thói quen buổi sáng'), (${me}, 'objective', ${jp.id}, 'Ôn 50 chữ kanji')`;
  await sql()`insert into tasks (user_id, kind, objective_id, title, done_at) values (${me}, 'objective', ${blog.id}, 'Bài đầu tiên', now())`;
  await page.goto("/today");

  // Not blocking: the day is all there, and the leftovers are still a "why" in capture.
  // Slice 13: Quarter Close runs inside the Quarterly Review, after the dashboard and the plans.
  const card = page.getByRole("region", { name: c.quarterReview.eyebrow(lastQuarter().replace(/^(\d{4})-(Q\d)$/, "$2 · $1")) });
  await card.getByRole("button", { name: c.quarterReview.skip, exact: true }).click();
  await card.getByRole("button", { name: c.quarterReview.next, exact: true }).click();
  await expect(card.getByText(c.quarterClose.title)).toBeVisible();
  await expect(page.locator('section[aria-labelledby="top3-h"]')).toBeVisible();
  await page.getByRole("button", { name: `${c.capture.open} (⌘K)` }).first().click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Viết blog đều", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await card.screenshot({ path: test.info().outputPath("card.png") }); // for the visual check

  await card.getByRole("group", { name: "Viết blog đều" }).getByRole("button", { name: c.quarterClose.carry }).click();
  await card.getByRole("group", { name: "Học tiếng Nhật" }).getByRole("button", { name: c.quarterClose.drop }).click();

  await expect(card.getByText(c.quarterClose.decisionQ)).toBeVisible();
  await card.screenshot({ path: test.info().outputPath("card-decision.png") });
  await card.getByRole("textbox", { name: c.life.decisionPlaceholder }).fill("Thôi học tiếng Nhật quý này");
  await card.getByRole("textbox", { name: c.life.drivenBy }).fill("Năng lượng buổi tối luôn thấp.");
  await card.getByRole("button", { name: c.quarterClose.save }).click();
  // Two active this quarter now (Day 1's and the carried copy): room for one more.
  await expect(card.getByText(c.quarterClose.addOneQ(2))).toBeVisible();
  await card.getByRole("button", { name: c.quarterClose.later }).click();
  await expect(card).toHaveCount(0);

  await settled(async () => (await sql()`select 1 from decisions where user_id = ${me}`).length === 1);
  const os = await sql()`select title, quarter, status from objectives where user_id = ${me} and title in ('Viết blog đều', 'Học tiếng Nhật') order by quarter, title`;
  expect(os).toEqual([
    { title: "Học tiếng Nhật", quarter: lastQuarter(), status: "dropped" },
    { title: "Viết blog đều", quarter: lastQuarter(), status: "carried" },
    { title: "Viết blog đều", quarter: thisQuarter(), status: "active" },
  ]);
  const tasks = await sql()`select t.title, t.closed_at, o.quarter from tasks t join objectives o on o.id = t.objective_id where t.user_id = ${me} and o.title in ('Viết blog đều', 'Học tiếng Nhật')`;
  expect(tasks.find((t) => t.title === "Bài về thói quen buổi sáng")).toMatchObject({ quarter: thisQuarter(), closed_at: null });
  expect(tasks.find((t) => t.title === "Bài đầu tiên")).toMatchObject({ quarter: lastQuarter() });
  expect(tasks.find((t) => t.title === "Ôn 50 chữ kanji")?.closed_at).not.toBeNull();

  const [qr] = await sql()`select health, completed_at from quarterly_reviews where user_id = ${me} and quarter = ${lastQuarter()}`;
  expect(qr.health).toBeNull(); // the dashboard was skipped
  expect(qr.completed_at).not.toBeNull();

  // Settled for good.
  await page.reload();
  await expect(page.locator('section[aria-labelledby="top3-h"]')).toBeVisible();
  await expect(page.getByText(c.quarterClose.title)).toHaveCount(0);
});
