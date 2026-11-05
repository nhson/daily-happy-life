// Phase 0 review gate: screenshots of every screen × sky state at phone and desktop sizes.
// Usage: node scripts/review-shots.mjs [baseUrl] [outDir] [--lang=vi|en]   (default vi → review/vi/*.png)
// Button names come from the copy dictionaries, so the walk works in either language.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { en } from "../src/copy/en.ts";
import { vi } from "../src/copy/vi.ts";

const args = process.argv.slice(2);
const lang = args.find((a) => a.startsWith("--lang="))?.slice(7) ?? "vi";
const [base = "http://localhost:3210", outRoot = "review"] = args.filter((a) => !a.startsWith("--"));
const c = { vi, en }[lang];
if (!c) throw new Error(`Unknown --lang=${lang}`);
const out = `${outRoot}/${lang}`;
// What a user of that language would type (user content is never translated, so sample it per language).
const typed = {
  en: {
    capture: "Call Mum about the weekend",
    when: "sit down after lunch",
    then: "write for twenty minutes",
    note: "Walked home the long way, by the lake.",
    workview: "Work is how I turn curiosity into useful tools.",
    lifeview: "Life is for the people I love and learning slowly.",
    objective: "Run three mornings a week",
    steps: ["Buy running shoes", "Map a 5k loop by the river", "Ask Minh to join on Saturdays"],
  },
  vi: {
    capture: "Gọi cho mẹ về chuyện cuối tuần",
    when: "ăn trưa xong và ngồi vào bàn",
    then: "viết trong hai mươi phút",
    note: "Đi bộ về nhà đường vòng, men theo hồ.",
    workview: "Công việc là cách mình biến sự tò mò thành những công cụ có ích.",
    lifeview: "Cuộc sống dành cho những người mình thương và việc học thật chậm.",
    objective: "Chạy bộ ba buổi sáng mỗi tuần",
    steps: ["Mua giày chạy bộ", "Vẽ một vòng chạy 5km dọc bờ sông", "Rủ Minh chạy cùng vào thứ Bảy"],
  },
}[lang];
mkdirSync(out, { recursive: true });

const sizes = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};

const browser = await chromium.launch();
const errors = [];

for (const [name, opts] of Object.entries(sizes)) {
  const ctx = await browser.newContext({ ...opts, timezoneId: "Asia/Ho_Chi_Minh", locale: lang === "vi" ? "vi-VN" : "en-GB" });
  // The Next.js dev badge isn't part of the app: keep it out of the shots.
  await ctx.addInitScript(() =>
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal { display: none !important; }";
      document.head.append(style);
    }),
  );
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && errors.push(`[${name}] ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`[${name}] pageerror: ${e.message}`));
  const shot = async (id, full = false) => {
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${out}/${name}-${id}.png`, fullPage: full });
  };
  const go = async (path, wait = 1600) => {
    await page.goto(base + path + (path.includes("?") ? "&" : "?") + `lang=${lang}`);
    await page.waitForTimeout(wait);
  };

  // Morning ritual
  await go("/today?reset=1&at=06:45", 3200);
  await shot("01-morning-compass");
  await page.getByRole("button", { name: c.morning.begin }).click();
  await page.waitForTimeout(700);
  await shot("02-morning-top3");
  const rows = page.locator(`[aria-label="${c.today.ritual}"] button[aria-pressed]`);
  for (let i = 0; i < 3 && i < (await rows.count()); i++) {
    if ((await rows.nth(i).getAttribute("aria-pressed")) !== "true") await rows.nth(i).click();
  }
  await shot("03-morning-top3-picked");
  await page.getByRole("button", { name: c.morning.continue }).click();
  await page.waitForTimeout(700);
  await page.getByPlaceholder(c.morning.whenPlaceholder).fill(typed.when);
  await page.getByPlaceholder(c.morning.thenPlaceholder).fill(typed.then);
  await shot("04-morning-intention");
  await page.getByRole("button", { name: c.morning.set }).click();
  await page.waitForTimeout(1400);

  // Day
  await go("/today?at=11:30", 2400);
  await shot("05-today-day", name === "phone");
  await go("/tasks?at=14:00");
  await shot("06-tasks", true);
  await page.keyboard.press(process.platform === "darwin" ? "Meta+k" : "Control+k");
  await page.waitForTimeout(700);
  await page.keyboard.type(typed.capture);
  await shot("07-capture");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  // A task's own sheet: edit, due date, let it go (the first one with a due date).
  await page.locator("[data-task] button[aria-haspopup=dialog]").filter({ hasText: /./ }).nth(1).click();
  await page.waitForTimeout(800);
  await shot("07b-task-sheet");
  await page.keyboard.press("Escape");
  await go("/life?at=16:10", 2200);
  await shot("08-life", true);
  // Switching plans: one sheet settles both sides, then the Decision.
  const makeActive = page.getByRole("button", { name: c.life.makeActive });
  if (await makeActive.count()) {
    await makeActive.first().click();
    await page.waitForTimeout(700);
    await shot("08b-promotion");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  }
  // Finishing an Objective with open tasks asks where they go.
  const prefix = c.life.markDone("\u0000").split("\u0000")[0];
  await page.getByRole("button", { name: new RegExp(`^${prefix}`) }).first().click();
  await page.waitForTimeout(700);
  if (await page.getByRole("dialog").count()) {
    await shot("08c-finish-objective");
    await page.keyboard.press("Escape");
  }

  // Evening → night
  await go("/today?at=19:20", 2600);
  await shot("09-evening-checkin-sheet");
  await page.getByRole("radio", { name: c.common.rating(c.checkIn.energy, 4, 5) }).click();
  await page.getByRole("radio", { name: c.common.rating(c.checkIn.engagement, 5, 5) }).click();
  await page.getByRole("button", { name: `${c.meaning.flow.name}: ${c.meaning.flow.hint}` }).click();
  await page.getByRole("button", { name: `${c.meaning.community.name}: ${c.meaning.community.hint}` }).click();
  await page.getByPlaceholder(c.checkIn.notePlaceholder).fill(typed.note);
  await shot("10-evening-checkin-filled");
  await page.getByRole("button", { name: c.checkIn.close, exact: true }).last().click();
  await page.waitForTimeout(3200);
  await shot("11-night-summary", name === "phone");

  // First run
  await go("/welcome?fresh=1&at=05:00", 1800);
  await shot("12-welcome");
  await page.getByRole("button", { name: c.welcome.start, exact: true }).click();
  await page.waitForTimeout(900);
  await shot("13-welcome-compass");

  // Onboarding: finish setup, then the in-context tips, nudge and reminder ask (SPEC §7).
  await page.locator("textarea").nth(0).fill(typed.workview);
  await page.locator("textarea").nth(1).fill(typed.lifeview);
  await page.getByRole("button", { name: c.welcome.next, exact: true }).click();
  await page.waitForTimeout(700);
  await page.locator("textarea").first().fill(typed.objective);
  await page.getByRole("button", { name: c.welcome.next, exact: true }).click();
  await page.waitForTimeout(700);
  for (const [i, t] of typed.steps.entries())
    await page.getByLabel(c.common.step(i + 1), { exact: true }).fill(t);
  await page.getByRole("button", { name: c.welcome.next, exact: true }).click();
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: typed.steps[2] }).click();
  await shot("14-welcome-for-today");
  await page.getByRole("button", { name: c.welcome.finish }).click();
  await page.waitForTimeout(6500);

  await go("/today?at=11:30", 2400);
  await shot("15-day1-today-tip");
  await page.keyboard.press(process.platform === "darwin" ? "Meta+k" : "Control+k");
  await page.waitForTimeout(800);
  await shot("16-capture-tip");
  await page.keyboard.press("Escape");

  await go("/today?day=2&at=11:30", 2400);
  await page.getByRole("button", { name: c.tips.gotIt }).click();
  await page.waitForTimeout(900);
  await shot("17-day2-odyssey-nudge");
  await page.getByRole("button", { name: c.today.ritual }).click();
  await page.waitForTimeout(3000);
  await shot("18-morning-tip");

  await go("/life?at=16:10", 2200);
  await shot("19-life-tip");
  await go("/life?plan=1&at=16:10", 2600);
  await shot("20-plan-editor-from-nudge");

  await go("/today?at=19:20", 2000);
  // The sheet rises by itself only once per evening, and step 09 already used that.
  await page.getByRole("button", { name: c.today.checkIn, exact: true }).first().click();
  await page.waitForTimeout(900);
  await shot("21-evening-tip");
  await page.getByRole("button", { name: c.checkIn.close, exact: true }).last().click();
  await page.waitForTimeout(3200);
  await shot("22-closed-day-tip");
  await page.getByRole("button", { name: c.tips.gotIt }).click();
  await page.waitForTimeout(900);
  await shot("23-reminder-ask");

  // Sky states for the contrast review
  for (const at of ["05:30", "06:00", "07:30", "12:00", "17:45", "18:15", "19:00", "23:00"]) {
    await go(`/tasks?reset=1&at=${at}`, 1400);
    await shot(`sky-${at.replace(":", "")}`);
  }
  await ctx.close();
}

await browser.close();
console.log(errors.length ? `Console errors:\n${[...new Set(errors)].join("\n")}` : "No console errors.");
