import { expect, test } from "@playwright/test";
import { at, c, hcmDate, seedSetUp, settled, sql, top3Rows } from "./support";

/**
 * Slice 11 (Phase 2 · Focus timer): a Focus Session starts from a Top 3 row, survives a reload
 * (the server has it), stops; when its time is up it asks done / another round / leave it, and the
 * Evening Check-in shows the minutes focused. The browser clock is pinned to a day in the past so
 * a session seeded "26 minutes before 10:00" is over for both the browser and the server.
 */
test.describe.serial("focus timer", () => {
  const T1 = "Viết trang giới thiệu";
  const T2 = "Gọi hai người dùng thử";
  const Y = hcmDate(-1);

  test("starts from a Top 3 row, survives a reload, stops", async ({ page }) => {
    await at(page, "10:00", -1);
    const me = await seedSetUp(page, Y);
    await page.goto("/today");
    await expect(top3Rows(page)).toHaveCount(2);

    await page.getByRole("button", { name: c.focus.startFor(T1) }).click();
    const bar = page.locator("[data-focus-bar]");
    await expect(bar).toContainText(T1);
    await expect(bar).toContainText(c.focus.left("25:00").replace("25:00", ""));
    await settled(async () => (await sql()`select 1 from focus_sessions where user_id = ${me} and ended_at is null and planned_minutes = 25`).length === 1);

    await page.reload();
    await expect(page.locator("[data-focus-bar]")).toContainText(T1);
    await expect(page.getByRole("button", { name: c.focus.stopFor(T1) }).first()).toHaveAttribute("aria-pressed", "true");

    // Starting another ends the first: only one runs.
    await page.getByRole("button", { name: c.focus.startFor(T2) }).click();
    await expect(page.locator("[data-focus-bar]")).toContainText(T2);
    await settled(async () => (await sql()`select 1 from focus_sessions where user_id = ${me} and ended_at is not null`).length === 1);

    await page.locator("[data-focus-bar]").getByRole("button", { name: c.focus.stopFor(T2) }).click();
    await expect(page.locator("[data-focus-bar]")).toHaveCount(0);
    await settled(async () => (await sql()`select 1 from focus_sessions where user_id = ${me} and ended_at is null`).length === 0);
    expect(await sql()`select 1 from focus_sessions where user_id = ${me}`).toHaveLength(2);
  });

  test("a length picked in the task sheet is remembered for the next one-tap start", async ({ page }) => {
    await at(page, "10:00", -1);
    const me = await seedSetUp(page, Y);
    await page.goto("/today");
    await top3Rows(page).filter({ hasText: T1 }).locator("button[aria-haspopup=dialog]").click();
    await page.getByRole("group", { name: c.focus.length }).getByRole("button", { name: c.focus.minutes(50) }).click();
    await expect(page.locator("[data-focus-bar]")).toContainText(T1);
    await settled(async () => (await sql()`select 1 from focus_sessions where user_id = ${me} and planned_minutes = 50`).length === 1);

    await page.reload();
    await page.getByRole("button", { name: c.focus.startFor(T2) }).click();
    await settled(async () => (await sql()`select 1 from focus_sessions where user_id = ${me} and planned_minutes = 50 and ended_at is null`).length === 1);
  });

  test("when its time is up it asks; 'Mark it done' finishes the task at the planned end", async ({ page }) => {
    await at(page, "10:00", -1);
    const me = await seedSetUp(page, Y);
    const [task] = await sql()`select id from tasks where user_id = ${me} and title = ${T1}`;
    await sql()`insert into focus_sessions (user_id, task_id, started_at, planned_minutes)
      values (${me}, ${task.id}, ${`${Y}T09:34:00+07:00`}, 25)`;
    await page.goto("/today");

    await expect(page.getByRole("heading", { name: c.focus.endTitle })).toBeVisible();
    await expect(page.getByText(c.focus.endBody(T1))).toBeVisible();
    await page.getByRole("button", { name: c.focus.markDone }).click();
    await expect(page.getByRole("heading", { name: c.focus.endTitle })).toBeHidden();

    await settled(async () => (await sql()`select 1 from tasks where id = ${task.id} and done_at is not null`).length === 1);
    await settled(async () => (await sql()`select 1 from focus_sessions where user_id = ${me} and ended_at is not null`).length === 1);
    const [s] = await sql()`select ended_at - started_at as took from focus_sessions where user_id = ${me}`;
    expect(String(s.took)).toMatch(/00:25:00|25 min/);
  });

  test("'Another round' starts the same length again on the same task", async ({ page }) => {
    await at(page, "10:00", -1);
    const me = await seedSetUp(page, Y);
    const [task] = await sql()`select id from tasks where user_id = ${me} and title = ${T2}`;
    await sql()`insert into focus_sessions (user_id, task_id, started_at, planned_minutes)
      values (${me}, ${task.id}, ${`${Y}T09:44:00+07:00`}, 15)`;
    await page.goto("/today");
    await page.getByRole("button", { name: `${c.focus.again} · ${c.focus.minutes(15)}` }).click();
    await expect(page.locator("[data-focus-bar]")).toContainText(T2);
    // The seeded round ended; a new one of the same length runs.
    await settled(async () => (await sql()`select 1 from focus_sessions where user_id = ${me}`).length === 2);
    await settled(async () => (await sql()`select 1 from focus_sessions where user_id = ${me} and ended_at is null and planned_minutes = 15`).length === 1);
    expect(await sql()`select 1 from tasks where id = ${task.id} and done_at is null`).toHaveLength(1);
  });

  test("the Evening Check-in shows the minutes focused today", async ({ page }) => {
    await at(page, "19:30", -1);
    const me = await seedSetUp(page, Y);
    const [task] = await sql()`select id from tasks where user_id = ${me} and title = ${T1}`;
    await sql()`insert into focus_sessions (user_id, task_id, started_at, planned_minutes, ended_at) values
      (${me}, ${task.id}, ${`${Y}T09:00:00+07:00`}, 50, ${`${Y}T09:50:00+07:00`}),
      (${me}, ${task.id}, ${`${Y}T14:00:00+07:00`}, 25, ${`${Y}T14:25:00+07:00`})`;
    await page.goto("/today");
    await expect(page.getByRole("heading", { name: c.checkIn.title })).toBeVisible();
    await expect(page.getByText(c.focus.today(c.focus.duration(75)))).toBeVisible();
  });
});
