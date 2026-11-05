import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { at, e2eUserId, hcmDate, seedSetUp, signIn, sql } from "./support";

/**
 * Slice 10: AA in every sky state (PLAN "A11y"). axe-core on each screen, signed in, with the sky
 * at dawn, day, dusk and night, plus the forced light and dark themes.
 */
const SKIES = [
  { name: "dawn", time: "05:40" },
  { name: "day", time: "10:00" },
  { name: "dusk", time: "18:30" },
  { name: "night", time: "22:30" },
];
const SCREENS = ["/today", "/tasks", "/life", "/settings"];

async function audit(page: Page, label: string) {
  await page.waitForTimeout(1200); // let entrances settle: contrast is checked on what is shown
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  return bad.map((v) => `${label} · ${v.id} (${v.impact}): ${v.nodes.slice(0, 4).map((n) => n.target.join(" ") + " — " + (n.failureSummary ?? "").split("\n").slice(1, 2).join("")).join(" | ")}`);
}

test.describe("accessibility", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await at(page, "10:00");
    await seedSetUp(page, hcmDate(0));
    await page.close();
  });

  for (const sky of SKIES)
    test(`AA at ${sky.name}`, async ({ page }) => {
      await at(page, sky.time);
      await signIn(page);
      const found: string[] = [];
      for (const s of SCREENS) {
        await page.goto(s);
        found.push(...(await audit(page, `${sky.name} ${s}`)));
      }
      console.log(found.join("\n"));
      expect(found).toEqual([]);
    });

  for (const theme of ["light", "dark"] as const)
    test(`AA with the ${theme} theme`, async ({ page }) => {
      await at(page, "10:00");
      await signIn(page);
      await sql()`update users set theme = ${theme} where id = ${await e2eUserId()}`;
      const found: string[] = [];
      for (const s of SCREENS) {
        await page.goto(s);
        found.push(...(await audit(page, `${theme} ${s}`)));
      }
      console.log(found.join("\n"));
      await sql()`update users set theme = 'sky' where id = ${await e2eUserId()}`;
      expect(found).toEqual([]);
    });

  test("AA in the morning ritual", async ({ page }) => {
    await at(page, "07:30", 1);
    await signIn(page);
    await page.goto("/today"); // the next morning: the ritual opens by itself
    const found = await audit(page, "ritual");
    await page.goto("/settings");
    console.log(found.join("\n"));
    expect(found).toEqual([]);
  });

  test("every control offers a 44px target (or its row, or a .hit area, does)", async ({ page }) => {
    await at(page, "10:00");
    await signIn(page);
    const small: string[] = [];
    for (const s of SCREENS) {
      await page.goto(s);
      await page.waitForTimeout(1200);
      small.push(
        ...(await page.evaluate(() =>
          [...document.querySelectorAll("button, a[href], input, select, textarea, [role=button]")]
            .filter((e) => (e as HTMLElement).offsetParent !== null && !e.classList.contains("hit") && !e.closest("label"))
            .map((e) => ({ e, r: e.getBoundingClientRect() }))
            .filter(({ r }) => r.width > 0 && (r.height < 44 || r.width < 44))
            .map(({ e, r }) => `${location.pathname} ${e.tagName.toLowerCase()} ${Math.round(r.width)}×${Math.round(r.height)} "${(e.getAttribute("aria-label") || (e as HTMLElement).innerText || "").slice(0, 40)}"`),
        )),
      );
    }
    expect(small).toEqual([]);
  });
});
