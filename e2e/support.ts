import { clerk } from "@clerk/testing/playwright";
import { createClerkClient } from "@clerk/backend";
import { neon } from "@neondatabase/serverless";
import { expect, type Page } from "@playwright/test";
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
 * Pin the browser's date and time to a local time in Ho Chi Minh City, `days` from today. Only
 * `Date` is pinned: timers and animation frames stay real, so transitions run as for a person.
 */
export async function at(page: Page, time: string, days = 0) {
  await page.clock.setFixedTime(new Date(`${hcmDate(days)}T${time}:00+07:00`));
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
