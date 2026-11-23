import { test, expect } from "./fixtures.js";
import { KEPT, SAVE, endTurn, newGame, pack, planMove, state, toSave, withSave } from "./helpers.js";

test("progress is there after a reload, walk plans included", async ({ page }) => {
  await page.goto("/");
  await page.locator("#play").click();
  await page.locator('[data-place="pebble"]').click();
  await page.reload();
  await expect(page.locator("#play")).toHaveText("Keep playing");
  await page.locator("#play").click();
  expect((await state(page)).bands[0].to).toBe("pebble");
});

test("an unreadable save is kept, and a new game does not write over it", async ({ page }) => {
  await withSave(page, "{this is not a save");
  await page.goto("/");
  await expect(page.locator(".note")).toContainText("kept safe");
  await page.locator("#play").click();
  await expect(page.locator("#go")).toBeVisible();
  const kept = await page.evaluate((k) => localStorage.getItem(k), KEPT);
  expect(kept).toBe("{this is not a save");
  const now = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE);
  expect(now.v).toBe(1);
});

test("a save from a future version is kept the same way", async ({ page }) => {
  const future = JSON.stringify({ ...JSON.parse(toSave(newGame(pack, 1))), v: 99 });
  await withSave(page, future);
  await page.goto("/");
  await page.locator("#play").click();
  expect(await page.evaluate((k) => localStorage.getItem(k), KEPT)).toBe(future);
});

test("a blocked store never stops play, and the game says it is not saving", async ({ page }) => {
  await page.addInitScript(() => {
    const no = () => { throw new DOMException("blocked", "SecurityError"); };
    Storage.prototype.getItem = no;
    Storage.prototype.setItem = no;
  });
  await page.goto("/");
  await expect(page.locator(".note")).toContainText("not saving");
  await page.locator("#play").click();
  await expect(page.locator(".warn")).toContainText("not saving");
  await page.locator('[data-place="pebble"]').click();
  await page.locator("#go").click();
  await page.locator("#moment-ok").click();
  await expect.poll(async () => (await state(page)).turn).toBe(2);
});

test("a full store keeps playing and says so", async ({ page }) => {
  await page.addInitScript(() => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "lanternkeep:save") throw new DOMException("full", "QuotaExceededError");
      return real.call(this, key, value);
    };
  });
  await page.goto("/");
  await page.locator("#play").click();
  await expect(page.locator(".warn")).toContainText("not saving");
});

test("a save code moves a game to a fresh device", async ({ page, browser }) => {
  const g = endTurn(pack, planMove(pack, newGame(pack, 33), 1, "pebble"));
  await withSave(page, { ...g, news: [] });
  await page.goto("/");
  await page.locator("#about").click();
  await page.locator("#open-code").click();
  const code = await page.locator("#code-out").inputValue();
  expect(code).toMatch(/^LK1\./);

  const other = await browser.newContext({ viewport: { width: 820, height: 1180 } });
  const fresh = await other.newPage();
  await fresh.goto("/".replace("/", page.url()));
  await fresh.locator("#about").click();
  await fresh.locator("#open-code").click();
  await fresh.locator("#code-in").fill(code);
  await fresh.locator("#load-code").click();
  await fresh.locator("#confirm-load").click();
  await expect(fresh.locator("#go")).toBeVisible();
  const moved = await state(fresh);
  expect(moved.seed).toBe(33);
  expect(moved.lit).toContain("pebble");
  await other.close();
});

test("a bad save code is refused and changes nothing", async ({ page }) => {
  await page.goto("/");
  await page.locator("#play").click();
  const before = await state(page);
  await page.getByRole("button", { name: "menu and about" }).click();
  await page.locator("#open-code").click();
  await page.locator("#code-in").fill("LK1.nope.nope");
  await page.locator("#load-code").click();
  await expect(page.locator("#code-note")).toContainText("did not work");
  expect((await state(page)).seed).toBe(before.seed);
});

test("start over asks first", async ({ page }) => {
  await page.goto("/");
  await page.locator("#play").click();
  await page.locator('[data-place="pebble"]').click();
  await page.locator("#go").click();
  await page.locator("#moment-ok").click();
  await page.getByRole("button", { name: "menu and about" }).click();
  await page.locator("#restart").click();
  await page.locator("#close").click();
  expect((await state(page)).lit).toContain("pebble");
  await page.getByRole("button", { name: "menu and about" }).click();
  await page.locator("#restart").click();
  await page.locator("#confirm-new").click();
  expect((await state(page)).lit).toEqual([pack.home]);
});

test("a second tab takes over without undoing anything", async ({ page, context }) => {
  await page.goto("/");
  await page.locator("#play").click();
  const second = await context.newPage();
  await second.goto(page.url());
  await second.locator("#play").click();
  await second.locator('[data-place="pebble"]').click();
  await expect(page.locator("#play-here")).toBeVisible();
  const saved = await page.evaluate((k) => localStorage.getItem(k), SAVE);
  expect(JSON.parse(saved).bands[0].to).toBe("pebble");
  await second.close();
});
