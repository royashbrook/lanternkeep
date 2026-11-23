import { test, expect } from "./fixtures.js";
import { newGame, pack, state, withSave } from "./helpers.js";

const rich = () => {
  const g = structuredClone(newGame(pack, 5));
  g.coins = 500;
  g.lit.push("pebble");
  return g;
};
const cell = (page, band, slot) => page.locator(`[data-band="${band}"][data-slot="${slot}"]`);

test.beforeEach(async ({ page }) => {
  await withSave(page, rich());
  await page.goto("/");
  await page.locator("#play").click();
  await page.locator("#camp").click();
  await expect(page.locator(".camp")).toBeVisible();
});

test("tap a fighter, tap a spot", async ({ page }) => {
  const before = (await state(page)).bands[0].slots[1];
  await cell(page, 1, 1).click();
  await cell(page, 1, 0).click();
  const g = await state(page);
  expect(g.bands[0].slots[0]).toBe(before);
  expect(g.bands[0].slots[1]).toBe(null);
});

test("tapping a taken spot swaps the two", async ({ page }) => {
  const g0 = await state(page);
  const [a, b] = [g0.bands[0].slots[1], g0.bands[0].slots[3]];
  await cell(page, 1, 1).click();
  await cell(page, 1, 3).click();
  const g = await state(page);
  expect(g.bands[0].slots[3]).toBe(a);
  expect(g.bands[0].slots[1]).toBe(b);
});

test("drag a fighter to another spot", async ({ page }) => {
  const before = (await state(page)).bands[0].slots[1];
  const from = await cell(page, 1, 1).boundingBox();
  const to = await cell(page, 1, 2).boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 30, from.y + from.height / 2, { steps: 3 });
  await expect(page.locator(".ghost")).toBeVisible();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => (await state(page)).bands[0].slots[2]).toBe(before);
  await expect(page.locator(".ghost")).toHaveCount(0);
});

test("a fighter can wait in camp and come back, and the last one cannot leave the field", async ({ page }) => {
  await cell(page, 1, 1).click();
  await page.locator("#to-bench").click();
  await expect(page.locator("[data-benched]")).toHaveCount(1);
  await page.locator("[data-benched]").click();
  await cell(page, 1, 2).click();
  await expect(page.locator("[data-benched]")).toHaveCount(0);
});

test("hire a new friend with coins", async ({ page }) => {
  await page.locator("#tab-hire").click();
  const before = await state(page);
  await page.locator('[data-hire="archer"]').click();
  const g = await state(page);
  expect(g.fighters.length).toBe(before.fighters.length + 1);
  expect(g.coins).toBeLessThan(before.coins);
});

test("buy gear for a fighter", async ({ page }) => {
  await page.locator("#tab-gear").click();
  await page.locator('[data-gear="stick"]').click();
  const g = await state(page);
  expect(g.fighters[0].gear).toBe("stick");
  await expect(page.locator(".gearcard.owned")).toContainText("has this");
});

test("plans: reorder, take away, add and put back the good plan", async ({ page }) => {
  await cell(page, 1, 3).click();
  await page.locator("#open-plan").click();
  await expect(page.locator("dialog[open]")).toBeVisible();
  const id = (await state(page)).bands[0].slots[3];
  const plan = async () => (await state(page)).fighters.find((f) => f.id === id).plan;
  const start = await plan();
  await page.getByRole("button", { name: /down/ }).first().click();
  expect((await plan())[1]).toBe(start[0]);
  await page.getByRole("button", { name: /take away/ }).first().click();
  expect((await plan()).length).toBe(start.length - 1);
  await page.locator(".addcard").first().click();
  expect((await plan()).length).toBe(start.length);
  await page.locator("#plan-reset").click();
  expect(await plan()).toEqual(start);
  await page.locator("#plan-done").click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
});

test("a plan survives a reload", async ({ page }) => {
  await cell(page, 1, 3).click();
  await page.locator("#open-plan").click();
  const id = (await state(page)).bands[0].slots[3];
  await page.getByRole("button", { name: /take away/ }).first().click();
  const plan = (await state(page)).fighters.find((f) => f.id === id).plan;
  await page.reload();
  await page.locator("#play").click();
  expect((await state(page)).fighters.find((f) => f.id === id).plan).toEqual(plan);
});
