import { clerk } from "@clerk/testing/playwright";
import { createClerkClient } from "@clerk/backend";
import { neon } from "@neondatabase/serverless";
import { expect, type Page } from "@playwright/test";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/data/db/schema";
import { completeOnboarding } from "../src/data/onboarding";
import { vi } from "../src/copy/vi";

export const c = vi;
/**
 * The test user: an alias of the owner's own address (mail to it reaches the owner, nobody else).
 * Signs in with a Clerk sign-in ticket made by the Backend API, so no mail is ever sent.
 */
export const E2E_EMAIL = "nguyenhoangson+dhl-e2e@gmail.com";
export const sql = () => neon(process.env.DATABASE_URL!);
export const clerkApi = () => createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

const HCM = "Asia/Ho_Chi_Minh";
/** Today's calendar date in Ho Chi Minh City, plus `days`. */
export function hcmDate(days = 0): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: HCM }).format(d);
}

/**
 * Set the browser's clock to a local time in Ho Chi Minh City, `days` from today; it keeps ticking
 * from there. Only `Date` moves: Playwright's own clock (`setFixedTime`, `install`) also stops the
 * timeline animations run on, so every exit transition would hang.
 */
export async function at(page: Page, time: string, days = 0) {
  const target = new Date(`${hcmDate(days)}T${time}:00+07:00`).getTime();
  await page.addInitScript((target: number) => {
    const Real = Date;
    const offset = target - Real.now();
    class Shifted extends Real {
      constructor(...args: ConstructorParameters<typeof Date> | []) {
        if (args.length === 0) super(Real.now() + offset);
        else super(...(args as ConstructorParameters<typeof Date>));
      }
      static now() {
        return Real.now() + offset;
      }
    }
    globalThis.Date = Shifted as DateConstructor;
  }, target);
}

export async function signIn(page: Page) {
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress: E2E_EMAIL });
}

/** The test user's row id in the app database. */
export async function e2eUserId(): Promise<string> {
  const [u] = await clerkApi().users.getUserList({ emailAddress: [E2E_EMAIL] }).then((r) => r.data);
  const rows = await sql()`select id from users where clerk_id = ${u.id}`;
  return rows[0]?.id;
}

export const top3Rows = (page: Page) => page.locator('section[aria-labelledby="top3-h"] [data-task]');

export async function capture(page: Page, title: string) {
  await page.getByRole("button", { name: `${c.capture.open} (⌘K)` }).first().click();
  const input = page.getByPlaceholder(c.capture.placeholder);
  await input.fill(title);
  await input.press("Enter");
  await expect(page.getByText(c.capture.added(1))).toBeVisible();
  await page.keyboard.press("Escape");
}

/** Wait until the server has caught up with what the screen already shows (optimistic saves). */
export async function settled(check: () => Promise<boolean>, ms = 15_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("server never caught up");
}

/** The visible row of a task, by its title. */
export const taskRow = (page: Page, title: string) => page.locator("[data-task]:visible").filter({ hasText: title });

/** Open a task's sheet by tapping its words. */
export async function openTask(page: Page, title: string) {
  await taskRow(page, title).locator("button[aria-haspopup=dialog]").first().click();
  await expect(page.getByRole("button", { name: c.taskSheet.save })).toBeVisible();
}

/**
 * A clean, set-up account for one spec: wipe the test user's rows, sign in (the app makes the user
 * row and plan slots), then run the real Day 1 setup code against the database, as of `setupDate`.
 */
export async function seedSetUp(page: Page, setupDate: string, tasks = ["Viết trang giới thiệu", "Gọi hai người dùng thử"]) {
  const [u] = (await clerkApi().users.getUserList({ emailAddress: [E2E_EMAIL] })).data;
  await sql()`delete from users where clerk_id = ${u.id}`;
  await signIn(page);
  await page.goto("/today");
  await expect(page).toHaveURL(/\/welcome/);
  const me = await e2eUserId();
  const db = drizzle({ client: neon(process.env.DATABASE_URL!), schema });
  const quarter = `${setupDate.slice(0, 4)}-Q${Math.floor((Number(setupDate.slice(5, 7)) - 1) / 3) + 1}`;
  await completeOnboarding(db as never, me, {
    compass: { workview: "Công việc là cách mình giúp người khác.", lifeview: "Cuộc sống dành cho người mình thương." },
    objective: { id: crypto.randomUUID(), title: "Ra mắt bản beta" },
    tasks: tasks.map((title) => ({ id: crypto.randomUUID(), title, today: true })),
    today: setupDate,
    quarter,
  });
  return me;
}
