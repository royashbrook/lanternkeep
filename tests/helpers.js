import { emberdale as pack } from "../src/content/emberdale.ts";
import { walkerMoves } from "../src/engine/bot.ts";
import { endTurn, finishBattle, newGame, planMove } from "../src/engine/campaign.ts";
import { toSave } from "../src/engine/save.ts";

export { pack, newGame, planMove, endTurn, finishBattle, toSave, walkerMoves };
export const SAVE = "lanternkeep:save";
export const KEPT = "lanternkeep:save:unreadable";
export const SIZES = {
  "ipad portrait": { width: 820, height: 1180 },
  "ipad landscape": { width: 1180, height: 820 },
  "phone portrait": { width: 390, height: 844 },
  "phone landscape": { width: 844, height: 390 },
};

/** the game the page is really holding */
export const state = (page) => page.evaluate(() => window.__lanternkeep.state());

/** a stored game, in place before the page's own scripts run. only the first load of a page gets it */
export async function withSave(page, game) {
  await page.addInitScript(([key, value]) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem(key, value);
  }, [SAVE, typeof game === "string" ? game : toSave(game)]);
}

/** a game further on, played by the real engine */
export function playedTo(turn, seed = 7) {
  let g = newGame(pack, seed);
  for (let i = 0; i < 400 && g.phase !== "won" && (g.turn < turn || g.phase === "battle"); i++) {
    g = g.phase === "plan" ? endTurn(pack, walkerMoves(pack, g)) : finishBattle(pack, g);
    g = { ...g, news: [] };
  }
  return g;
}

/** taps through whatever stands between here and the map */
export async function toMap(page) {
  for (let i = 0; i < 400; i++) {
    // a good-news moment sits on top of the map, so it is looked for first
    if (await page.locator("#moment-ok").isVisible()) await page.locator("#moment-ok").click();
    else if (await page.locator("#battle-ok").isVisible()) await page.locator("#battle-ok").click();
    // a short battle can end by itself between the look and the tap, which is fine
    else if (await page.locator("#skip:enabled").isVisible()) await page.locator("#skip").click({ timeout: 700 }).catch(() => {});
    else if (await page.locator(".win").isVisible()) return;
    else if (await page.locator("#go").isVisible()) return;
    else await page.waitForTimeout(30);
  }
  throw Error("never got back to the map");
}

/** every visible control clears 44px on its short side */
export const smallTargets = (page) =>
  page.evaluate(() => {
    const open = [...document.querySelectorAll("dialog[open]")].pop();
    return [...(open ?? document).querySelectorAll("button, a[href], [role=button]")]
      .filter((el) => el.offsetParent !== null)
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && Math.min(r.width, r.height) < 44)
      .map(({ el, r }) => `${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30)} ${Math.round(r.width)}x${Math.round(r.height)}`);
  });

/** the page itself never scrolls, and nothing important hangs off the screen */
export const overflow = (page) =>
  page.evaluate(() => {
    const d = document.documentElement;
    return d.scrollWidth > innerWidth + 1 || d.scrollHeight > innerHeight + 1;
  });
export const offScreen = (page, selector) =>
  page.evaluate((s) => [...document.querySelectorAll(s)].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1);
  }).length, selector);
