import { test, expect } from "./fixtures.js";
import { SIZES, endTurn, newGame, offScreen, overflow, pack, planMove, playedTo, smallTargets, state, toSave } from "./helpers.js";

const seed = (page, game) =>
  page.addInitScript(([g]) => {
    localStorage.setItem("lanternkeep:settings", JSON.stringify({ music: false, sfx: false }));
    if (g) localStorage.setItem("lanternkeep:save", g);
  }, [game ? toSave(game) : null]);

const midGame = () => ({ ...playedTo(4), coins: 300 });
const fight = () => endTurn(pack, planMove(pack, newGame(pack, 21), 1, "mill"));

for (const [name, viewport] of Object.entries(SIZES)) {
  test.describe(name, () => {
    test.use({ viewport });

    const check = async (page, what, needed) => {
      expect(await overflow(page), `${what} scrolls the page`).toBe(false);
      expect(await smallTargets(page), `${what} small targets`).toEqual([]);
      for (const selector of needed) {
        await expect(page.locator(selector).first(), `${what} ${selector}`).toBeVisible();
        expect(await offScreen(page, selector), `${what} ${selector} off screen`).toBe(0);
      }
    };

    test("title", async ({ page }) => {
      await seed(page, null);
      await page.goto("/");
      await check(page, "title", ["#play", "#howto", "#about", "#version"]);
    });

    test("map", async ({ page }) => {
      await seed(page, midGame());
      await page.goto("/");
      await page.locator("#play").click();
      await check(page, "map", ["#go", "#camp", ".pin", ".chip"]);
      // all the places are on the board and none covers another's middle
      const hit = await page.evaluate(() => [...document.querySelectorAll(".pin")].filter((el) => {
        const r = el.getBoundingClientRect();
        const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return !el.contains(top);
      }).map((el) => el.dataset.place));
      expect(hit).toEqual([]);
    });

    test("camp", async ({ page }) => {
      await seed(page, midGame());
      await page.goto("/");
      await page.locator("#play").click();
      await page.locator("#camp").click();
      await check(page, "bands", ["#camp-back", ".cell"].slice(0, 1));
      await page.locator("#tab-hire").click();
      await check(page, "hire", ["#camp-back"]);
      await page.locator("#tab-gear").click();
      await check(page, "gear", ["#camp-back"]);
    });

    test("battle", async ({ page }) => {
      await seed(page, fight());
      await page.goto("/");
      await page.locator("#play").click();
      await check(page, "battle", ["#skip", "#pause", ".unit"]);
      await page.locator("#skip").click();
      await check(page, "result", ["#battle-ok"]);
    });

    test("win", async ({ page }) => {
      await seed(page, playedTo(999));
      await page.goto("/");
      await page.locator("#play").click();
      await check(page, "win", ["#again", ".winlanterns span", ".parade span"]);
    });

    test("about reaches its last line by scrolling the sheet", async ({ page }) => {
      await seed(page, null);
      await page.goto("/");
      await page.locator("#about").click();
      expect(await smallTargets(page)).toEqual([]);
      await page.locator(".maker").scrollIntoViewIfNeeded();
      await expect(page.locator(".maker")).toBeInViewport();
      await page.locator("#close").scrollIntoViewIfNeeded();
      await expect(page.locator("#close")).toBeInViewport();
    });
  });
}

test("turning the tablet in the middle of a battle keeps the battle and the game", async ({ page }) => {
  await seed(page, fight());
  await page.setViewportSize(SIZES["ipad portrait"]);
  await page.goto("/");
  await page.locator("#play").click();
  await expect(page.locator(".battle")).not.toHaveClass(/land/);
  await page.locator("#pause").click();
  const caption = await page.locator(".caption").textContent();
  await page.setViewportSize(SIZES["ipad landscape"]);
  await expect(page.locator(".battle")).toHaveClass(/land/);
  expect(await page.locator(".caption").textContent()).toBe(caption);
  expect(await overflow(page)).toBe(false);
  await expect(page.locator("#skip")).toBeInViewport();
  await page.locator("#skip").click();
  await expect(page.locator(".resultcard")).toBeVisible();
});

test("turning the tablet on the map keeps the plan and redraws the board", async ({ page }) => {
  await seed(page, null);
  await page.setViewportSize(SIZES["ipad landscape"]);
  await page.goto("/");
  await page.locator("#play").click();
  await page.locator('[data-place="pebble"]').click();
  const before = await page.locator('[data-place="pebble"]').boundingBox();
  await page.setViewportSize(SIZES["ipad portrait"]);
  await expect.poll(async () => (await page.locator('[data-place="pebble"]').boundingBox()).x).not.toBe(before.x);
  expect((await state(page)).bands[0].to).toBe("pebble");
  expect(await overflow(page)).toBe(false);
});

test("class and state never rely on colour alone", async ({ page }) => {
  await seed(page, midGame());
  await page.goto("/");
  await page.locator("#play").click();
  await page.locator("#camp").click();
  // one badge outline per class on the field, so two classes never differ by colour only
  const seen = await page.evaluate(() => [...document.querySelectorAll(".bandcard .cell.full")].map((c) => [c.querySelector(".cellname")?.textContent?.trim(), c.querySelector(".badge path")?.getAttribute("d")]));
  const g = await state(page);
  const classOf = Object.fromEntries(g.fighters.map((f) => [f.name.replace(/^(Captain|The) /, ""), f.cls]));
  const shapeOf = new Map();
  for (const [name, d] of seen) {
    const cls = classOf[name];
    expect(d).toBeTruthy();
    if (shapeOf.has(cls)) expect(shapeOf.get(cls)).toBe(d);
    shapeOf.set(cls, d);
  }
  expect(new Set(shapeOf.values()).size).toBe(shapeOf.size);
  expect(shapeOf.size).toBeGreaterThanOrEqual(5);
});
