import { expect, test } from "@playwright/test";
import { at, c, capture, e2eUserId, hcmDate, openTask, settled, signIn, sql, taskRow, top3Rows, wipe } from "./support";

/**
 * A new account's first two days, signed in, against the real database:
 * Slice 3 (first run, morning ritual once per Logical Day, carry-over) and Slice 2 (capture,
 * edit, due date, let go, delete). Serial: each step builds on the last.
 */
test.describe.serial("day one and the morning after", () => {
  const steps = ["Viết trang giới thiệu", "Gọi hai người dùng thử", "Đặt tên miền"];

  test("first run: Compass → Objective → tasks → today's picks, saved at once", async ({ page }) => {
    await at(page, "08:00");
    await wipe(); // a brand-new account, whatever ran before
    await signIn(page);
    await page.goto("/today");
    await expect(page).toHaveURL(/\/welcome/);
    // While a step slides out, its (inert) form is still in the DOM: act on the present one.
    const next = () => page.locator("form:not([inert])").getByRole("button", { name: c.welcome.next, exact: true }).click();

    await page.getByRole("button", { name: c.welcome.start, exact: true }).click();
    await expect(page.getByText(c.welcome.workviewQ)).toBeVisible();
    await page.locator("textarea").nth(0).fill("Công việc là cách mình làm cho ngày của người khác nhẹ hơn.");
    await page.locator("textarea").nth(1).fill("Cuộc sống dành cho người mình thương.");
    await next();
    await expect(page.getByText(c.welcome.objectiveQ)).toBeVisible();
    await page.locator("textarea").first().fill("Ra mắt bản beta");
    await next();
    await expect(page.getByText(c.welcome.tasksQ)).toBeVisible();
    for (const [i, t] of steps.entries()) await page.getByLabel(c.common.step(i + 1), { exact: true }).fill(t);
    await next();
    await expect(page.getByText(c.welcome.todayQ)).toBeVisible();
    // All three start picked; keep the third for later.
    await page.getByRole("button", { name: steps[2], exact: true }).click();
    await page.locator("form:not([inert])").getByRole("button", { name: c.welcome.finish }).click();

    await expect(page).toHaveURL(/\/today/, { timeout: 20_000 });
    await expect(top3Rows(page)).toHaveCount(2);

    const me = await e2eUserId();
    await settled(async () => (await sql()`select 1 from users where id = ${me} and onboarded_at is not null`).length === 1);
    const [log] = await sql()`select morning_at, top3_task_ids from daily_logs where user_id = ${me} and date = ${hcmDate()}`;
    expect(log.morning_at).not.toBeNull();
    expect(log.top3_task_ids).toHaveLength(2);
    expect(await sql()`select title from tasks where user_id = ${me} order by title`).toHaveLength(3);
    expect((await sql()`select workview from compass where user_id = ${me}`)[0].workview).toContain("nhẹ hơn");

    // Survives a reload: it came from the server, not the browser.
    await page.reload();
    await expect(top3Rows(page)).toHaveCount(2);
    await expect(page.getByRole("button", { name: c.morning.begin })).toHaveCount(0);
  });

  test("capture on a phone is type + Enter, with the last why preselected", async ({ page }) => {
    await at(page, "10:00");
    await signIn(page);
    await page.goto("/today");
    await capture(page, "Sửa lỗi chính tả trên trang chủ");

    const me = await e2eUserId();
    await settled(async () => (await sql()`select 1 from tasks where user_id = ${me} and title = 'Sửa lỗi chính tả trên trang chủ'`).length === 1);
    const [t] = await sql()`select kind, objective_id from tasks where user_id = ${me} and title = 'Sửa lỗi chính tả trên trang chủ'`;
    expect(t.kind).toBe("objective");
    expect(t.objective_id).not.toBeNull();

    await page.goto("/tasks");
    await expect(page.getByText("Sửa lỗi chính tả trên trang chủ")).toBeVisible();
  });

  test("a task's sheet: due today shows on Today; let go keeps history; delete leaves no trace", async ({ page }) => {
    await at(page, "11:00");
    await signIn(page);
    await page.goto("/tasks");
    const me = await e2eUserId();

    // Due today → the "Due" section on Today.
    await openTask(page, steps[2]);
    await page.getByLabel(c.taskSheet.due).fill(hcmDate());
    await page.getByRole("button", { name: c.taskSheet.save }).click();
    await settled(async () => (await sql()`select 1 from tasks where user_id = ${me} and title = ${steps[2]} and due_date = ${hcmDate()}`).length === 1);
    await page.goto("/today");
    const due = page.locator('section[aria-labelledby="due-h"]');
    await expect(due.getByText(steps[2])).toBeVisible();
    await expect(due.getByText(c.due.today)).toBeVisible();

    // Let go: gone from the list, still in the database.
    await page.goto("/tasks");
    await openTask(page, steps[2]);
    await page.getByRole("button", { name: c.taskSheet.close }).click();
    await expect(taskRow(page, steps[2])).toHaveCount(0);
    await settled(async () => (await sql()`select 1 from tasks where user_id = ${me} and title = ${steps[2]} and closed_at is not null`).length === 1);

    // Delete (two taps): gone everywhere.
    await openTask(page, "Sửa lỗi chính tả trên trang chủ");
    await page.getByRole("button", { name: c.taskSheet.delete }).click();
    await page.getByRole("button", { name: c.taskSheet.deleteConfirm }).click();
    await settled(async () => (await sql()`select 1 from tasks where user_id = ${me} and title = 'Sửa lỗi chính tả trên trang chủ'`).length === 0);

    // Finish one of today's Top 3, so tomorrow carries only the other.
    await page.goto("/today");
    await page.getByRole("button", { name: c.taskRow.complete(steps[0]) }).click();
    await settled(async () => (await sql()`select 1 from tasks where user_id = ${me} and title = ${steps[0]} and done_at is not null`).length === 1);
  });

  test("next morning: the ritual opens once, offering yesterday's unfinished Top 3", async ({ page }) => {
    await at(page, "07:30", 1);
    await signIn(page);
    await page.goto("/today");
    const me = await e2eUserId();

    const ritual = page.locator(`[aria-label="${c.today.ritual}"]`);
    // Day one was never closed: the ritual first offers to close it. Not now.
    await expect(ritual.getByText(c.yesterday.title)).toBeVisible();
    await ritual.getByRole("button", { name: c.yesterday.skip, exact: true }).click();
    await page.getByRole("button", { name: c.morning.begin }).click();
    await expect(ritual.getByText(c.morning.carryOver)).toBeVisible();
    // Carried over: the unfinished one, preselected; the finished one is not offered.
    const carried = ritual.getByRole("button", { name: new RegExp(steps[1]) });
    await expect(carried).toHaveAttribute("aria-pressed", "true");
    await expect(ritual.getByRole("button", { name: new RegExp(steps[0]) })).toHaveCount(0);

    await page.getByRole("button", { name: c.morning.continue }).click();
    await page.getByPlaceholder(c.morning.whenPlaceholder).fill("ăn sáng xong");
    await page.getByPlaceholder(c.morning.thenPlaceholder).fill("gọi người dùng thử đầu tiên");
    await page.getByRole("button", { name: c.morning.set }).click();
    await expect(top3Rows(page)).toHaveCount(1);

    await settled(async () => (await sql()`select 1 from daily_logs where user_id = ${me} and date = ${hcmDate(1)} and morning_at is not null and intention is not null`).length === 1);
    const [log] = await sql()`select intention, top3_task_ids from daily_logs where user_id = ${me} and date = ${hcmDate(1)}`;
    expect(log.intention).toEqual({ when: "ăn sáng xong", then: "gọi người dùng thử đầu tiên" });
    expect(log.top3_task_ids).toHaveLength(1);

    // Once per Logical Day: a reload goes straight to the day.
    await page.reload();
    await expect(top3Rows(page)).toHaveCount(1);
    await expect(page.getByRole("button", { name: c.morning.begin })).toHaveCount(0);
    await expect(page.getByText("gọi người dùng thử đầu tiên")).toBeVisible();
  });
});
