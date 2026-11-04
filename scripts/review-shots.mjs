// Phase 0 review gate: screenshots of every screen × sky state at phone and desktop sizes.
// Usage: node scripts/review-shots.mjs [baseUrl] [outDir]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3210";
const out = process.argv[3] ?? "review";
mkdirSync(out, { recursive: true });

const sizes = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};

const browser = await chromium.launch();
const errors = [];

for (const [name, opts] of Object.entries(sizes)) {
  const ctx = await browser.newContext({ ...opts, timezoneId: "Asia/Ho_Chi_Minh", locale: "en-GB" });
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && errors.push(`[${name}] ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`[${name}] pageerror: ${e.message}`));
  const shot = async (id, full = false) => {
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${out}/${name}-${id}.png`, fullPage: full });
  };
  const go = async (path, wait = 1600) => {
    await page.goto(base + path);
    await page.waitForTimeout(wait);
  };

  // Morning ritual
  await go("/today?reset=1&at=06:45", 3200);
  await shot("01-morning-compass");
  await page.getByRole("button", { name: "Begin the day" }).click();
  await page.waitForTimeout(700);
  await shot("02-morning-top3");
  const rows = page.locator('[aria-label="Morning ritual"] button[aria-pressed]');
  for (let i = 0; i < 3 && i < (await rows.count()); i++) {
    if ((await rows.nth(i).getAttribute("aria-pressed")) !== "true") await rows.nth(i).click();
  }
  await shot("03-morning-top3-picked");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForTimeout(700);
  await page.getByPlaceholder("sit down after lunch").fill("sit down after lunch");
  await page.getByPlaceholder("write for twenty minutes").fill("write for twenty minutes");
  await shot("04-morning-intention");
  await page.getByRole("button", { name: "Set my intention" }).click();
  await page.waitForTimeout(1400);

  // Day
  await go("/today?at=11:30", 2400);
  await shot("05-today-day", name === "phone");
  await go("/tasks?at=14:00");
  await shot("06-tasks", true);
  await page.keyboard.press(process.platform === "darwin" ? "Meta+k" : "Control+k");
  await page.waitForTimeout(700);
  await page.keyboard.type("Call Mum about the weekend");
  await shot("07-capture");
  await page.keyboard.press("Escape");
  await go("/life?at=16:10", 2200);
  await shot("08-life", true);

  // Evening → night
  await go("/today?at=19:20", 2600);
  await shot("09-evening-checkin-sheet");
  await page.getByRole("radio", { name: "Energy 4 of 5" }).click();
  await page.getByRole("radio", { name: "Engagement 5 of 5" }).click();
  await page.getByRole("button", { name: /^Flow:/ }).click();
  await page.getByRole("button", { name: /^Community:/ }).click();
  await page.getByPlaceholder("A moment worth keeping").fill("Walked home the long way, by the lake.");
  await shot("10-evening-checkin-filled");
  await page.getByRole("button", { name: "Close the day" }).last().click();
  await page.waitForTimeout(3200);
  await shot("11-night-summary", name === "phone");

  // First run
  await go("/welcome?fresh=1&at=05:00", 1800);
  await shot("12-welcome");
  await page.getByRole("button", { name: "Start" }).click();
  await page.waitForTimeout(900);
  await shot("13-welcome-compass");

  // Onboarding: finish setup, then the in-context tips, nudge and reminder ask (SPEC §7).
  await page.locator("textarea").nth(0).fill("Work is how I turn curiosity into useful tools.");
  await page.locator("textarea").nth(1).fill("Life is for the people I love and learning slowly.");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.waitForTimeout(700);
  await page.locator("textarea").first().fill("Run three mornings a week");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.waitForTimeout(700);
  for (const [i, t] of ["Buy running shoes", "Map a 5k loop by the river", "Ask Minh to join on Saturdays"].entries())
    await page.getByLabel(`Step ${i + 1}`).fill(t);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "Ask Minh to join on Saturdays" }).click();
  await shot("14-welcome-for-today");
  await page.getByRole("button", { name: "Watch the sun come up" }).click();
  await page.waitForTimeout(6500);

  await go("/today?at=11:30", 2400);
  await shot("15-day1-today-tip");
  await page.keyboard.press(process.platform === "darwin" ? "Meta+k" : "Control+k");
  await page.waitForTimeout(800);
  await shot("16-capture-tip");
  await page.keyboard.press("Escape");

  await go("/today?day=2&at=11:30", 2400);
  await page.getByRole("button", { name: "Got it" }).click();
  await page.waitForTimeout(900);
  await shot("17-day2-odyssey-nudge");
  await page.getByRole("button", { name: "Morning ritual" }).click();
  await page.waitForTimeout(3000);
  await shot("18-morning-tip");

  await go("/life?at=16:10", 2200);
  await shot("19-life-tip");
  await go("/life?plan=1&at=16:10", 2600);
  await shot("20-plan-editor-from-nudge");

  await go("/today?at=19:20", 2000);
  // The sheet rises by itself only once per evening, and step 09 already used that.
  await page.getByRole("button", { name: "Check in" }).click();
  await page.waitForTimeout(900);
  await shot("21-evening-tip");
  await page.getByRole("button", { name: "Close the day" }).last().click();
  await page.waitForTimeout(3200);
  await shot("22-closed-day-tip");
  await page.getByRole("button", { name: "Got it" }).click();
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
