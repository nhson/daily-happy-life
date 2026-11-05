import { neon } from "@neondatabase/serverless";
import { expect, test, type Page } from "@playwright/test";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/data/db/schema";
import { setActivePlan } from "../src/data/plans";
import { at, c, hcmDate, seedSetUp, settled, sql } from "./support";

/**
 * Slice 6: the Life page. Switching the Active Plan settles both sides in one sheet — the old
 * plan's Objectives kept or dropped, the new plan's open Prototypes folded or closed — and ends
 * with a pre-filled Decision. Finishing an Objective asks where its open tasks go.
 */
const quarter = () => `${hcmDate().slice(0, 4)}-Q${Math.floor((Number(hcmDate().slice(5, 7)) - 1) / 3) + 1}`;

/** Day 1 done; Plan 1 ("Current Path") active and named, Plan 2 written, with one open Prototype. */
async function seedPlans(page: Page) {
  const me = await seedSetUp(page, hcmDate(0));
  await sql()`update odyssey_plans set title = 'Làm sản phẩm ở công ty', is_active = true where user_id = ${me} and slot = 1`;
  await sql()`update odyssey_plans set title = 'Mở một studio nhỏ', is_active = false where user_id = ${me} and slot = 2`;
  const [p2] = await sql()`select id from odyssey_plans where user_id = ${me} and slot = 2`;
  await sql()`insert into tasks (user_id, kind, prototype_plan_id, title) values (${me}, 'prototype', ${p2.id}, 'Cà phê với chủ một studio')`;
  return { me, p2: p2.id as string };
}

test.describe.serial("life page", () => {
  test("promoting a plan with open Prototypes settles both sides, then logs the Decision", async ({ page }) => {
    await at(page, "10:00");
    const { me, p2 } = await seedPlans(page);
    await page.goto("/life");

    await page.getByRole("button", { name: c.life.makeActive }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText(c.promotion.title("Mở một studio nhỏ"))).toBeVisible();
    // The old plan's Objective: Drop it.
    const old = sheet.getByRole("region", { name: c.promotion.oldObjectives("Làm sản phẩm ở công ty") });
    await expect(old.getByRole("button", { name: c.promotion.keep })).toHaveAttribute("aria-pressed", "true");
    await old.getByRole("button", { name: c.promotion.drop }).click();
    // The open Prototype can't be left as it is: fold it (into a new Objective, named) or close it.
    const protos = sheet.getByRole("region", { name: c.promotion.prototypes });
    await expect(protos.getByText("Cà phê với chủ một studio")).toBeVisible();
    await protos.getByRole("textbox").fill("");
    await expect(sheet.getByRole("button", { name: c.promotion.confirm })).toBeDisabled();
    await protos.getByRole("textbox").fill("Thử studio thật");
    await sheet.getByRole("button", { name: c.promotion.confirm }).click();

    // Pre-filled Decision, linked to the plan.
    await expect(sheet.getByText(c.promotion.decisionTitle)).toBeVisible();
    await expect(sheet.getByRole("textbox", { name: c.life.decisionPlaceholder })).toHaveValue(c.promotion.decisionText("Mở một studio nhỏ"));
    await sheet.getByPlaceholder(c.life.drivenByPlaceholder).fill("Ba buổi cà phê cho thấy mình thích việc này hơn.");
    await sheet.getByRole("button", { name: c.life.logDecision }).click();
    await expect(page.getByText("Ba buổi cà phê cho thấy mình thích việc này hơn.")).toBeVisible();

    await settled(async () => (await sql()`select 1 from decisions where user_id = ${me} and linked_plan_id = ${p2}`).length === 1);
    expect((await sql()`select slot from odyssey_plans where user_id = ${me} and is_active`).map((r) => r.slot)).toEqual([2]);
    const os = await sql()`select title, status, plan_id from objectives where user_id = ${me} order by created_at`;
    expect(os).toEqual([
      expect.objectContaining({ title: "Ra mắt bản beta", status: "dropped" }),
      expect.objectContaining({ title: "Thử studio thật", status: "active", plan_id: p2 }),
    ]);
    // The dropped Objective's open tasks were closed; the Prototype is now real work under the new one.
    const tasks = await sql()`select t.title, t.kind, t.closed_at, o.title as objective from tasks t left join objectives o on o.id = t.objective_id where t.user_id = ${me}`;
    for (const t of tasks.filter((x) => x.objective === "Ra mắt bản beta")) expect(t.closed_at).not.toBeNull();
    expect(tasks.find((t) => t.title === "Cà phê với chủ một studio")).toMatchObject({ kind: "objective", objective: "Thử studio thật", closed_at: null });
    const [d] = await sql()`select decision from decisions where user_id = ${me}`;
    expect(d.decision).toBe(c.promotion.decisionText("Mở một studio nhỏ"));
  });

  test("the server refuses a switch that leaves open Prototypes unsettled", async ({ page }) => {
    await at(page, "10:00");
    const { me, p2 } = await seedPlans(page);
    // Straight to the data layer the Server Action uses, as a tampered client would.
    const db = drizzle({ client: neon(process.env.DATABASE_URL!), schema });
    const [o] = await sql()`select id from objectives where user_id = ${me}`;
    const ctx = { quarter: quarter(), now: new Date().toISOString(), newObjectiveId: crypto.randomUUID() };
    expect(await setActivePlan(db as never, me, p2, { objectives: { [o.id]: "keep" }, prototypes: null }, ctx)).toEqual({ ok: false, error: "resolution_required" });
    expect((await sql()`select slot from odyssey_plans where user_id = ${me} and is_active`).map((r) => r.slot)).toEqual([1]);
  });

  test("finishing an Objective asks once where its open tasks go", async ({ page }) => {
    await at(page, "10:00");
    const me = await seedSetUp(page, hcmDate(0));
    const [p1] = await sql()`select id from odyssey_plans where user_id = ${me} and slot = 1`;
    await sql()`insert into objectives (user_id, plan_id, title, quarter) values (${me}, ${p1.id}, 'Khỏe hơn', ${quarter()})`;
    await page.goto("/life");

    await page.getByRole("button", { name: c.life.markDone("Ra mắt bản beta") }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText(c.finish.title("Ra mắt bản beta"))).toBeVisible();
    await expect(sheet.getByRole("button", { name: c.finish.close })).toHaveAttribute("aria-pressed", "true");
    await sheet.getByRole("button", { name: c.finish.move("Khỏe hơn") }).click();
    await sheet.getByRole("button", { name: c.finish.confirm }).click();
    await expect(sheet).toHaveCount(0);

    await settled(async () => (await sql()`select 1 from objectives where user_id = ${me} and title = 'Ra mắt bản beta' and status = 'done'`).length === 1);
    const open = await sql()`select o.title from tasks t join objectives o on o.id = t.objective_id where t.user_id = ${me} and t.done_at is null and t.closed_at is null`;
    expect(open.length).toBeGreaterThan(0);
    expect(open.every((r) => r.title === "Khỏe hơn")).toBe(true);
  });
});
