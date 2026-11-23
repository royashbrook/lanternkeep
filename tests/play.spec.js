import { test, expect } from "./fixtures.js";
import { pack, state, toMap, walkerMoves } from "./helpers.js";

// the whole game, through the real screen: taps only, nothing poked into the page
test("from a new game to winning the region", async ({ page }) => {
  test.setTimeout(240000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/");
  await page.locator("#play").click();
  await expect(page.locator("#go")).toBeVisible();
  let turns = 0;
  for (; turns < 60; turns++) {
    await toMap(page);
    if (await page.locator(".win").isVisible()) break;
    const g = await state(page);
    const planned = walkerMoves(pack, g);
    for (const b of planned.bands) {
      if (!b.to) continue;
      await page.locator(`[data-chip="${b.id}"]`).click();
      await page.locator(`[data-place="${b.to}"]`).click();
    }
    const after = await state(page);
    for (const b of planned.bands) expect(after.bands.find((x) => x.id === b.id).to).toBe(b.to);
    await page.locator("#go").click();
  }
  await expect(page.locator(".win")).toBeVisible();
  await expect(page.locator(".win h1")).toHaveText("Emberdale is bright again!");
  const won = await state(page);
  expect(won.phase).toBe("won");
  expect(won.lit.length).toBe(pack.places.length);
  expect(errors).toEqual([]);
  // and it is still won after a reload
  await page.reload();
  await page.locator("#play").click();
  await expect(page.locator(".win")).toBeVisible();
});

test("the first turn teaches itself", async ({ page }) => {
  await page.goto("/");
  await page.locator("#play").click();
  await expect(page.locator(".hint")).toHaveText("Tap a glowing town to walk there.");
  await page.locator('[data-place="pebble"]').click();
  await expect(page.locator(".hint")).toHaveText("Tap Go when you are ready.");
  // tapping the same place again takes the walk back
  await page.locator('[data-chip="1"]').click();
  await page.locator('[data-place="pebble"]').click();
  expect((await state(page)).bands[0].to).toBe(null);
});

test("lighting a town is a moment, then the town stays lit", async ({ page }) => {
  await page.goto("/");
  await page.locator("#play").click();
  await page.locator('[data-place="pebble"]').click();
  await page.locator("#go").click();
  await expect(page.locator('.moment[data-moment="lit"]')).toBeVisible();
  await expect(page.locator(".moment h2")).toHaveText("Pebble Cross is lit!");
  await page.locator("#moment-ok").click();
  await expect(page.locator('[data-place="pebble"]')).toHaveAttribute("data-state", "lit");
});

test("waiting a turn is always allowed", async ({ page }) => {
  await page.goto("/");
  await page.locator("#play").click();
  await page.locator("#go").click();
  await expect.poll(async () => (await state(page)).turn).toBe(2);
});

test("the keep is locked and says so", async ({ page }) => {
  await page.goto("/");
  await page.locator("#play").click();
  const keep = page.locator('[data-place="keep"]');
  await expect(keep).toHaveAttribute("aria-label", /locked until every other lantern is lit/);
  await keep.click();
  await expect(page.locator(".placeinfo")).toContainText("is locked");
});
