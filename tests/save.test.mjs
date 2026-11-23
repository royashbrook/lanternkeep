import test from "node:test";
import assert from "node:assert/strict";
import { emberdale as pack } from "../src/content/emberdale.ts";
import { currentBattle, endTurn, finishBattle, newGame, planMove } from "../src/engine/campaign.ts";
import { checkGame, fromCode, fromSave, toCode, toSave } from "../src/engine/save.ts";

const midBattle = () => endTurn(pack, planMove(pack, newGame(pack, 11), 1, "mill"));
const broken = (edit) => {
  const raw = JSON.parse(toSave(newGame(pack, 1)));
  edit(raw);
  return checkGame(pack, raw);
};

test("a save comes back the same", () => {
  const g = endTurn(pack, planMove(pack, newGame(pack, 5), 1, "pebble"));
  assert.deepEqual(fromSave(pack, toSave(g)), { ...g, news: [] });
});

test("a reload in the middle of a turn keeps the planned walk", () => {
  const g = planMove(pack, newGame(pack, 5), 1, "pebble");
  assert.equal(fromSave(pack, toSave(g)).bands[0].to, "pebble");
});

test("a reload in the middle of a battle replays the same battle and pays out once", () => {
  const g = midBattle();
  const back = fromSave(pack, toSave(g));
  assert.equal(back.phase, "battle");
  assert.deepEqual(currentBattle(pack, back), currentBattle(pack, g));
  assert.deepEqual(finishBattle(pack, back).coins, finishBattle(pack, g).coins);
});

test("anything that is not a save is refused", () => {
  for (const raw of [null, "", "nope", "{}", "[]", "42", '{"v":1}', '{"v":2,"pack":"emberdale"}']) assert.equal(fromSave(pack, raw), null, String(raw));
});

test("a save with broken numbers is refused", () => {
  const cases = {
    "a future version": (r) => (r.v = 2),
    "another pack": (r) => (r.pack = "elsewhere"),
    "negative coins": (r) => (r.coins = -1),
    "fractional coins": (r) => (r.coins = 1.5),
    "infinite coins": (r) => (r.coins = 1e400),
    "turn zero": (r) => (r.turn = 0),
    "no home lantern": (r) => (r.lit = ["pebble"]),
    "an unknown lit place": (r) => r.lit.push("atlantis"),
    "a repeated lit place": (r) => r.lit.push(r.lit[0]),
    "no fighters": (r) => (r.fighters = []),
    "an unknown class": (r) => (r.fighters[0].cls = "dragon"),
    "a level too high": (r) => (r.fighters[0].level = 99),
    "a card the class cannot use": (r) => (r.fighters[0].plan = ["sing-all"]),
    "too many cards": (r) => (r.fighters[0].plan = ["hit-near", "hit-best", "hit-big", "hit-hurt"]),
    "unknown gear": (r) => (r.fighters[0].gear = "laser"),
    "the same fighter twice": (r) => (r.fighters[1].id = r.fighters[0].id),
    "a band nowhere": (r) => (r.bands[0].at = "nowhere"),
    "a walk with no road": (r) => (r.bands[0].to = "keep"),
    "too few spots": (r) => (r.bands[0].slots = [null]),
    "a fighter in two spots": (r) => (r.bands[1].slots[0] = r.bands[0].slots[1]),
    "a ghost fighter": (r) => (r.bands[0].slots[0] = 999),
    "every band empty": (r) => r.bands.forEach((b) => (b.slots = [null, null, null, null, null, null])),
    "too many bands": (r) => (r.bands = [...r.bands, ...r.bands, ...r.bands].map((b, i) => ({ ...b, id: i + 1, slots: [null, null, null, null, null, null] }))),
    "gloom in the home town": (r) => (r.gloom[0].at = pack.home),
    "gloom that is not in the pack": (r) => (r.gloom[0].id = "g-nope"),
    "a gloomling with too much health": (r) => (r.gloom[0].units[0].hp = 9999),
    "a gloomling already gone": (r) => (r.gloom[0].units[0].hp = 0),
    "a battle with nothing queued": (r) => (r.phase = "battle"),
    "a queue with no battle": (r) => (r.queue = [{ band: 1, gloom: r.gloom[0].id }]),
    "won without the lantern": (r) => (r.phase = "won"),
    "the lantern lit but not won": (r) => r.lit.push(pack.goal),
    "an odd phase": (r) => (r.phase = "party"),
    "no stats": (r) => delete r.stats,
  };
  for (const [name, edit] of Object.entries(cases)) assert.equal(broken(edit), null, name);
});

test("a queued battle has to be a real meeting", () => {
  const raw = JSON.parse(toSave(midBattle()));
  raw.bands[0].at = "pebble";
  raw.bands[0].to = null;
  assert.equal(checkGame(pack, raw), null);
});

test("a save code moves a game", () => {
  const g = endTurn(pack, planMove(pack, newGame(pack, 77), 1, "pebble"));
  const code = toCode(g);
  assert.match(code, /^LK1\.[A-Za-z0-9_-]+\.[a-z0-9]+$/);
  assert.deepEqual(fromCode(pack, code), { ...g, news: [] });
  assert.deepEqual(fromCode(pack, `  ${code.slice(0, 20)}\n${code.slice(20)} `), { ...g, news: [] }, "pasted with stray spaces");
});

test("a mid-battle game survives a save code", () => {
  const g = midBattle();
  assert.deepEqual(currentBattle(pack, fromCode(pack, toCode(g))), currentBattle(pack, g));
});

test("a bad code is refused", () => {
  const code = toCode(newGame(pack, 1));
  for (const bad of ["", "hello", "LK1..", code.slice(0, -2), code.replace("LK1", "LK9"), `${code}x`, `LK1.${"A".repeat(40)}.abc`]) assert.equal(fromCode(pack, bad), null, bad);
  const parts = code.split(".");
  const flipped = (parts[1][10] === "A" ? "B" : "A");
  assert.equal(fromCode(pack, `${parts[0]}.${parts[1].slice(0, 10)}${flipped}${parts[1].slice(11)}.${parts[2]}`), null);
});
