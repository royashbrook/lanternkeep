import { test, expect } from "./fixtures.js";
import { state } from "./helpers.js";

const ETHOS = "no ads, no lives, no timers, nothing to buy, no accounts, no cookies, nothing sold or shared.";

test("the page and the about sheet carry the house ethos, word for word", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("meta[name=description]")).toHaveAttribute("content", new RegExp(ETHOS.replaceAll(".", "\\.")));
  await page.locator("#about").click();
  await expect(page.locator(".sheet-title")).toHaveText("lanternkeep");
  await expect(page.locator(".ethos")).toHaveText(ETHOS);
  await expect(page.locator(".maker")).toContainText("made with love by");
});

test("the build is on screen and matches what was served", async ({ page }) => {
  await page.goto("/");
  const served = await (await page.request.get("/version.json")).json();
  await expect(page.locator("#version")).toHaveText(`v${served.version}`);
  await expect(page.locator("meta[name=build]")).toHaveAttribute("content", served.build);
  await page.locator("#about").click();
  await expect(page.locator(".version")).toContainText(served.build);
});

test("how to play opens in the app", async ({ page }) => {
  await page.goto("/");
  await page.locator("#howto").click();
  await expect(page.getByRole("heading", { name: "How to play" })).toBeVisible();
  await expect(page.locator(".matchups")).toContainText("Knights beat riders");
  await page.locator("#close").click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
});

test("escape closes a sheet", async ({ page }) => {
  await page.goto("/");
  await page.locator("#about").click();
  await expect(page.locator("dialog[open]")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
});

test("the game runs on the live content security policy with nothing refused", async ({ page }) => {
  const refused = [];
  page.on("console", (m) => { if (/content security policy/i.test(m.text())) refused.push(m.text()); });
  await page.goto("/");
  await page.locator("#play").click();
  await page.locator('[data-place="mill"]').click();
  await page.locator("#go").click();
  await expect(page.locator(".arena")).toBeVisible();
  await page.waitForTimeout(1200);
  await page.locator("#skip").click();
  await expect(page.locator(".resultcard")).toBeVisible();
  expect(refused).toEqual([]);
});

test("music and sound remember their setting, and the test run makes no noise", async ({ page }) => {
  await page.goto("/");
  await page.locator("#play").click();
  await page.getByRole("button", { name: "menu and about" }).click();
  await page.locator("#music").click();
  await expect(page.locator("#music")).toHaveAttribute("aria-checked", "false");
  await page.locator("#sounds").click();
  await expect(page.locator("#sounds")).toHaveAttribute("aria-checked", "false");
  await page.reload();
  await page.locator("#about").click();
  await expect(page.locator("#music")).toHaveText("Music: off");
  await expect(page.locator("#sounds")).toHaveText("Sounds: off");
  expect(await page.evaluate(() => window.__quiet?.loud ?? 0)).toBe(0);
});

test("the game makes its sound through the silent output", async ({ page }) => {
  await page.goto("/");
  await page.locator("#play").click();
  await page.locator('[data-place="pebble"]').click();
  await page.locator("#go").click();
  await expect(page.locator(".moment")).toBeVisible();
  await page.waitForTimeout(400);
  const q = await page.evaluate(() => window.__quiet);
  expect(q.loud).toBe(0);
});

test("no cookies, and every request stays on this origin", async ({ page, context }) => {
  const away = [];
  page.on("request", (r) => { if (!r.url().startsWith(new URL(page.url() === "about:blank" ? r.url() : page.url()).origin) && !r.url().startsWith("data:")) away.push(r.url()); });
  await page.goto("/");
  await page.locator("#play").click();
  await page.locator('[data-place="pebble"]').click();
  await page.locator("#go").click();
  await expect(page.locator(".moment")).toBeVisible();
  expect(away).toEqual([]);
  expect(await context.cookies()).toEqual([]);
});

test.describe("offline and updates", () => {
  test("after one visit the game starts and plays with no network", async ({ page, context }) => {
    await page.goto("/");
    await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 20000 });
    await context.setOffline(true);
    await page.reload();
    await page.locator("#play").click();
    await page.locator('[data-place="pebble"]').click();
    await page.locator("#go").click();
    await page.locator("#moment-ok").click();
    await expect.poll(async () => (await state(page)).turn).toBe(2);
    await context.setOffline(false);
  });

  test("check for update says so when this is the newest", async ({ page }) => {
    await page.goto("/");
    await page.locator("#about").click();
    await page.getByRole("button", { name: "Check for update" }).click();
    await expect(page.locator(".card [role=status]")).toHaveText("You have the newest version.");
    await expect(page.locator(".update")).toHaveCount(0);
  });
});

test.describe("with no service worker in the way of the probe", () => {
  test.use({ serviceWorkers: "block" });
  test("a newer build waits for a tap before it loads", async ({ page }) => {
    await page.route((url) => url.searchParams.has("update-probe"), (route) =>
      route.fulfill({ contentType: "text/html", body: '<!doctype html><meta name="build" content="a-newer-build">' }),
    );
    await page.goto("/");
    await page.locator("#about").click();
    await page.getByRole("button", { name: "Check for update" }).click();
    await expect(page.locator(".card [role=status]")).toHaveText("A new version is ready.");
    await page.locator("#close").click();
    await expect(page.locator(".update")).toHaveText("New version, tap to load");
    const build = await page.locator("meta[name=build]").getAttribute("content");
    await page.waitForTimeout(400);
    await expect(page.locator("meta[name=build]")).toHaveAttribute("content", build);
  });
});
