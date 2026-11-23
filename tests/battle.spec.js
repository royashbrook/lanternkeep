import { test, expect } from "./fixtures.js";
import { endTurn, newGame, pack, planMove, state, withSave } from "./helpers.js";

const intoBattle = () => endTurn(pack, planMove(pack, newGame(pack, 21), 1, "mill"));

test.beforeEach(async ({ page }) => {
  await withSave(page, intoBattle());
  await page.goto("/");
  await page.locator("#play").click();
  await expect(page.locator(".arena")).toBeVisible();
});

test("a battle plays itself to a result", async ({ page }) => {
  await page.getByRole("button", { name: "speed 4" }).click();
  await expect(page.locator(".resultcard")).toBeVisible({ timeout: 60000 });
});

test("skip goes straight to the end, and the result is the one the engine promised", async ({ page }) => {
  await page.locator("#skip").click();
  await expect(page.locator(".resultcard h2")).toHaveText("You won!");
  await page.locator("#battle-ok").click();
  const g = await state(page);
  expect(g.fights).toBe(1);
  expect(g.gloom.some((b) => b.id === "g-mill")).toBe(false);
  expect(g.lit).toContain("mill");
});

test("pause holds the battle still and play carries on", async ({ page }) => {
  await page.locator("#pause").click();
  await expect(page.locator("#pause")).toHaveAttribute("aria-pressed", "true");
  const before = await page.locator(".caption").textContent();
  const round = await page.locator(".battle").getAttribute("data-round");
  await page.waitForTimeout(1500);
  expect(await page.locator(".caption").textContent()).toBe(before);
  expect(await page.locator(".battle").getAttribute("data-round")).toBe(round);
  await page.locator("#pause").click();
  await page.getByRole("button", { name: "speed 4" }).click();
  await expect(page.locator(".resultcard")).toBeVisible({ timeout: 60000 });
});

test("the menu is reachable mid-battle and holds the battle still", async ({ page }) => {
  await page.locator("#battle-menu").click();
  await expect(page.locator("dialog[open]")).toBeVisible();
  const caption = await page.locator(".caption").textContent();
  await page.waitForTimeout(1500);
  expect(await page.locator(".caption").textContent()).toBe(caption);
  await page.locator("#close").click();
  await page.getByRole("button", { name: "speed 4" }).click();
  await expect(page.locator(".resultcard")).toBeVisible({ timeout: 60000 });
});

test("your fighter's chosen plan card is shown as it fights", async ({ page }) => {
  await page.getByRole("button", { name: "speed 2" }).click();
  await expect(page.locator("#plan-cue")).toHaveText(/^(Waffle|Pickle|Biscuit)'s plan: /, { timeout: 20000 });
});

test("speed is one tap and shows which one is on", async ({ page }) => {
  const two = page.getByRole("button", { name: "speed 2" });
  await two.click();
  await expect(two).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "speed 1" })).toHaveAttribute("aria-pressed", "false");
});

test("fighters have accessible names with their row and health", async ({ page }) => {
  await expect(page.getByRole("img", { name: /Waffle the knight, front row, \d+ of \d+ health/ })).toBeVisible();
  await expect(page.getByRole("img", { name: /puffling, front row/ })).toBeVisible();
});

test("a reload in the middle of a battle comes back to the same battle, paid once", async ({ page }) => {
  await page.reload();
  await page.locator("#play").click();
  await expect(page.locator(".arena")).toBeVisible();
  expect((await state(page)).phase).toBe("battle");
  await page.locator("#skip").click();
  await page.locator("#battle-ok").click();
  const g = await state(page);
  expect(g.fights).toBe(1);
  expect(g.stats.wins).toBe(1);
});

test.describe("reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });
  test("nothing animates, and the battle still finishes", async ({ page }) => {
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
    const moving = () => page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").map((a) => `${a.animationName ?? a.transitionProperty ?? "script"} on ${a.effect?.target?.getAttribute?.("class") ?? a.effect?.target?.tagName}`));
    expect(await moving()).toEqual([]);
    await page.getByRole("button", { name: "speed 4" }).click();
    await page.waitForTimeout(900);
    expect(await page.locator(".shot").count()).toBe(0);
    expect(await moving()).toEqual([]);
    await expect(page.locator(".resultcard")).toBeVisible({ timeout: 60000 });
  });
});
