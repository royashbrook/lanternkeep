import test from "node:test";
import assert from "node:assert/strict";
import { emberdale as pack } from "../src/content/emberdale.ts";
import { MAX_ROUNDS, fight, foeStats, statsOf } from "../src/engine/battle.ts";
import {
  YAWN_LIMIT, buyGear, currentBattle, endTurn, finishBattle, fightersIn, hireCost, maxBands, maxSize, movesFor,
  neighbours, newGame, offers, placeFighter, planMove, recruit, resetPlan, safePlace, setPlan,
} from "../src/engine/campaign.ts";

const unit = (side, slot, cls, over = {}) => {
  const s = statsOf(pack.classes[cls], 1);
  return { side, slot, cls, name: cls, level: 1, max: s.max, hp: s.max, power: s.power, speed: s.speed, plan: [...pack.classes[cls].plan], ref: slot, ...over };
};
const play = (g) => {
  let n = g;
  for (let i = 0; n.phase === "battle" && i < 50; i++) n = finishBattle(pack, n);
  return n;
};

test("the pack hangs together", () => {
  const ids = new Set(pack.places.map((p) => p.id));
  assert.ok(pack.places.length >= 8 && pack.places.length <= 10);
  assert.equal(Object.keys(pack.classes).length, 8);
  for (const [a, b] of pack.roads) assert.ok(ids.has(a) && ids.has(b), `${a}-${b}`);
  const seen = new Set([pack.home]);
  const walk = [pack.home];
  while (walk.length) for (const n of neighbours(pack, walk.pop())) if (!seen.has(n)) (seen.add(n), walk.push(n));
  assert.equal(seen.size, ids.size, "every place can be reached");
  for (const c of Object.values(pack.classes)) {
    assert.ok(c.plan.length >= 1 && c.plan.length <= 3, c.id);
    for (const id of c.plan) assert.ok(c.cards.includes(id), `${c.id} default ${id}`);
    for (const id of c.cards) assert.ok(pack.cards[id], `${c.id} card ${id}`);
  }
  for (const d of pack.gloom) {
    assert.ok(!d.route.includes(pack.home), `${d.id} never enters home`);
    assert.equal(d.route[0], d.at);
    d.route.forEach((id, i) => {
      const next = d.route[(i + 1) % d.route.length];
      if (d.route.length > 1) assert.ok(neighbours(pack, id).includes(next), `${d.id} ${id}-${next}`);
    });
    assert.equal(new Set(d.units.map((u) => u.slot)).size, d.units.length);
  }
});

test("the matchups read the way the game says", () => {
  const c = pack.classes;
  assert.deepEqual([...c.rider.beats].sort(), ["archer", "mage"]);
  assert.deepEqual(c.archer.beats, ["flyer"]);
  assert.deepEqual(c.mage.beats, ["knight"]);
  assert.deepEqual(c.knight.beats, ["rider"]);
  assert.equal(c.scout.reach, "any");
});

test("a battle is the same every time for the same seed", () => {
  const a = [unit("band", 1, "knight"), unit("band", 3, "archer"), unit("band", 5, "healer")];
  const b = [unit("gloom", 1, "rider"), unit("gloom", 4, "mage")];
  assert.deepEqual(fight(pack, a, b, 42), fight(pack, a, b, 42));
});

test("the dice change a battle, not the rules", () => {
  const a = [unit("band", 1, "knight"), unit("band", 3, "archer")];
  const b = [unit("gloom", 1, "rider"), unit("gloom", 4, "mage")];
  const logs = new Set();
  for (let s = 0; s < 40; s++) logs.add(JSON.stringify(fight(pack, a, b, s).events));
  assert.ok(logs.size > 1);
});

test("every battle ends, even one nobody can finish", () => {
  const tank = (side, slot) => unit(side, slot, "healer", { max: 5000, hp: 5000, power: 1 });
  const log = fight(pack, [tank("band", 0), tank("band", 1)], [tank("gloom", 0), tank("gloom", 1)], 3);
  assert.ok(log.timedOut);
  assert.equal(log.rounds, MAX_ROUNDS);
  assert.equal(log.events.at(-1).t, "end");
});

test("a time-out goes to the side with more strength left, and to the player on a tie", () => {
  const big = (side, slot, hp) => unit(side, slot, "knight", { max: 5000, hp, power: 1 });
  assert.equal(fight(pack, [big("band", 0, 4000)], [big("gloom", 0, 1000)], 1).win, true);
  assert.equal(fight(pack, [big("band", 0, 1000)], [big("gloom", 0, 4000)], 1).win, false);
  assert.equal(fight(pack, [big("band", 0, 3000)], [big("gloom", 0, 3000)], 9).timedOut, true);
});

test("the front row protects the back row from fighters who cannot reach", () => {
  const log = fight(pack, [unit("band", 0, "knight", { speed: 99, plan: ["hit-near"] })], [unit("gloom", 0, "healer", { max: 200, hp: 200 }), unit("gloom", 3, "mage", { max: 200, hp: 200 })], 5);
  const first = log.events.find((e) => e.t === "hit" && e.by === 0);
  assert.equal(log.units[first.to].slot, 0);
});

test("a scout slips past the front row", () => {
  const log = fight(pack, [unit("band", 0, "scout", { speed: 99, plan: ["hit-back"] })], [unit("gloom", 1, "healer", { max: 200, hp: 200 }), unit("gloom", 4, "mage", { max: 200, hp: 200 })], 5);
  const first = log.events.find((e) => e.t === "hit" && e.by === 0);
  assert.equal(log.units[first.to].slot, 4);
});

test("strong matchups hit harder", () => {
  const hit = (cls) => fight(pack, [unit("band", 0, "rider", { speed: 99, plan: ["hit-near"] })], [unit("gloom", 0, cls, { max: 500, hp: 500, speed: 1 })], 8).events.find((e) => e.t === "hit" && e.by === 0);
  assert.equal(hit("archer").strong, true);
  assert.equal(hit("healer").strong, false);
  assert.ok(hit("archer").n > hit("healer").n);
});

test("plans run in order and fall through when a card does not fit", () => {
  const archer = { plan: ["hit-flyer", "hit-near"], speed: 99 };
  const noFlyer = fight(pack, [unit("band", 0, "archer", archer)], [unit("gloom", 0, "knight", { max: 300, hp: 300 })], 1);
  assert.equal(noFlyer.events.find((e) => e.t === "think" && e.by === 0).card, "hit-near");
  const flyer = fight(pack, [unit("band", 0, "archer", archer)], [unit("gloom", 0, "knight", { max: 300, hp: 300 }), unit("gloom", 4, "flyer", { max: 300, hp: 300 })], 1);
  const think = flyer.events.find((e) => e.t === "think" && e.by === 0);
  assert.equal(think.card, "hit-flyer");
});

test("a healer heals the most hurt friend and never past full", () => {
  const log = fight(pack, [unit("band", 0, "healer", { speed: 99 }), unit("band", 1, "knight", { hp: 5 })], [unit("gloom", 0, "knight", { max: 300, hp: 300, power: 1 })], 2);
  const heal = log.events.find((e) => e.t === "heal");
  assert.equal(log.units[heal.to].slot, 1);
  for (const e of log.events) if (e.t === "heal") assert.ok(e.hp <= log.units[e.to].max);
});

test("a fighter with an empty plan still acts", () => {
  const log = fight(pack, [unit("band", 0, "knight", { plan: [], speed: 99 })], [unit("gloom", 0, "knight")], 1);
  assert.ok(log.events.some((e) => e.t === "hit" && e.by === 0));
});

test("a new game: two bands of three at home, everything else dark", () => {
  const g = newGame(pack, 1);
  assert.equal(g.bands.length, 2);
  for (const b of g.bands) {
    assert.equal(fightersIn(g, b).length, 3);
    assert.equal(b.at, pack.home);
  }
  assert.deepEqual(g.lit, [pack.home]);
  assert.equal(maxSize(g), 3);
  assert.equal(maxBands(pack, g), 2);
});

test("a band moves one road, and only along a road", () => {
  const g = newGame(pack, 1);
  assert.deepEqual(new Set(movesFor(pack, g, 1)), new Set(neighbours(pack, pack.home)));
  assert.equal(planMove(pack, g, 1, "keep"), g);
  const n = planMove(pack, g, 1, "pebble");
  assert.equal(n.bands[0].to, "pebble");
  assert.equal(planMove(pack, n, 1, null).bands[0].to, null);
  assert.equal(g.bands[0].to, null, "the old game is not changed");
});

test("walking onto a dark, empty place lights it and pays", () => {
  const g = newGame(pack, 1);
  const n = endTurn(pack, planMove(pack, g, 1, "pebble"));
  assert.ok(n.lit.includes("pebble"));
  assert.ok(n.news.some((x) => x.k === "lit" && x.place === "pebble"));
  assert.ok(n.coins > g.coins);
  assert.equal(n.turn, 2);
});

test("the gloom always goes where it said it would", () => {
  let g = newGame(pack, 1);
  for (let i = 0; i < 12; i++) {
    if (g.phase !== "plan") g = play(g);
    const said = g.gloom.map((b) => [b.id, b.to ?? b.at]);
    g = endTurn(pack, g);
    for (const [id, to] of said) {
      const b = g.gloom.find((x) => x.id === id);
      if (b) assert.equal(b.at, to, `${id} on turn ${g.turn}`);
    }
    g = play(g);
  }
});

test("the gloom never walks into the home town, and two never share a place", () => {
  let g = newGame(pack, 3);
  for (let i = 0; i < 40; i++) {
    g = play(endTurn(pack, g));
    const at = g.gloom.map((b) => b.at);
    assert.equal(new Set(at).size, at.length);
    assert.ok(!at.includes(pack.home));
  }
});

test("meeting a gloom band starts a battle, and finishing it twice changes nothing", () => {
  const g = endTurn(pack, planMove(pack, newGame(pack, 1), 1, "mill"));
  assert.equal(g.phase, "battle");
  assert.ok(currentBattle(pack, g));
  assert.deepEqual(currentBattle(pack, g), currentBattle(pack, g), "watching it again is the same battle");
  const done = finishBattle(pack, g);
  assert.equal(done.fights, g.fights + 1);
  assert.equal(finishBattle(pack, done), done, "there is nothing left to finish");
});

test("a beaten band walks home and nobody is lost", () => {
  let g = newGame(pack, 1);
  g = structuredClone(g);
  g.bands[0].at = "pebble";
  g.bands[0].to = "moss";
  g.lit.push("pebble");
  for (const u of g.gloom.find((b) => b.id === "g-moss").units) u.level = 9;
  for (const u of g.gloom.find((b) => b.id === "g-moss").units) u.hp = foeStats(pack, u.foe, 9).max;
  const before = g.fighters.length;
  const met = endTurn(pack, g);
  assert.equal(met.phase, "battle");
  assert.equal(currentBattle(pack, met).win, false);
  const after = finishBattle(pack, met);
  assert.equal(after.fighters.length, before);
  assert.notEqual(after.bands[0].at, "moss");
  assert.ok(after.lit.includes(after.bands[0].at));
  assert.equal(after.gloom.find((b) => b.id === "g-moss").yawns, 1);
  assert.ok(after.news.some((x) => x.k === "home"));
});

test("every band beaten: everyone is home, the turn goes on and the map keeps its lights", () => {
  let g = structuredClone(newGame(pack, 2));
  g.lit.push("pebble");
  for (const b of g.bands) (b.at = "pebble"), (b.to = "moss");
  for (const u of g.gloom.find((b) => b.id === "g-moss").units) (u.level = 9), (u.hp = foeStats(pack, u.foe, 9).max);
  g = play(endTurn(pack, g));
  assert.equal(g.phase, "plan");
  for (const b of g.bands) assert.ok(g.lit.includes(b.at));
  assert.ok(g.lit.includes("pebble"));
  assert.ok(movesFor(pack, g, 1).length > 0);
});

/** every lantern but the great one is lit, and only the keep's own gloom is left */
const keepOpen = (seed = 1) => {
  const g = structuredClone(newGame(pack, seed));
  g.lit = pack.places.filter((p) => p.id !== pack.goal).map((p) => p.id);
  g.gloom = g.gloom.filter((b) => b.id === "g-keep");
  return g;
};

test("the keep stays shut until every other lantern is lit", () => {
  const shut = structuredClone(newGame(pack, 1));
  shut.bands[0].at = "cloud";
  assert.ok(!movesFor(pack, shut, 1).includes(pack.goal));
  assert.equal(planMove(pack, shut, 1, pack.goal), shut);
  const open = keepOpen();
  open.bands[0].at = "cloud";
  assert.ok(movesFor(pack, open, 1).includes(pack.goal));
});

test("each win by the gloom makes it sleepier, until it cannot fight at all", () => {
  let g = keepOpen();
  const foe = g.gloom.find((b) => b.id === "g-keep");
  for (const u of foe.units) (u.level = 9), (u.hp = foeStats(pack, u.foe, 9).max);
  foe.yawns = YAWN_LIMIT;
  g.bands[0].at = "cloud";
  g.bands[0].to = "keep";
  const met = endTurn(pack, g);
  assert.equal(currentBattle(pack, met).win, true);
  assert.equal(finishBattle(pack, met).phase, "won");
});

test("a retreat never ends up on a place with gloom in it", () => {
  const g = structuredClone(newGame(pack, 1));
  g.lit.push("pebble", "mill");
  g.gloom[0].at = "pebble";
  const safe = safePlace(pack, g, "moss");
  assert.notEqual(safe, "pebble", "the nearest lit town has gloom in it");
  assert.ok(g.lit.includes(safe));
  assert.ok(!g.gloom.some((b) => b.at === safe));
});

test("a band with nobody in it cannot walk and cannot stop the turn", () => {
  let g = newGame(pack, 1);
  for (const id of g.bands[1].slots.filter((s) => s !== null)) g = placeFighter(pack, g, id, null, 0);
  assert.equal(fightersIn(g, g.bands[1]).length, 0);
  assert.deepEqual(movesFor(pack, g, 2), []);
  const n = endTurn(pack, g);
  assert.ok(n.phase === "plan" || n.phase === "battle");
});

test("nobody can empty the whole field", () => {
  let g = newGame(pack, 1);
  const ids = g.fighters.map((f) => f.id);
  for (const id of ids) g = placeFighter(pack, g, id, null, 0);
  assert.ok(g.bands.some((b) => b.slots.some((s) => s !== null)));
});

test("moving onto a taken spot swaps the two fighters", () => {
  const g = newGame(pack, 1);
  const a = g.bands[0].slots[1];
  const b = g.bands[0].slots[3];
  const n = placeFighter(pack, g, a, 1, 3);
  assert.equal(n.bands[0].slots[3], a);
  assert.equal(n.bands[0].slots[1], b);
});

test("a full band takes nobody new, but still swaps", () => {
  const g = newGame(pack, 1);
  const newcomer = g.bands[1].slots[1];
  assert.equal(placeFighter(pack, g, newcomer, 1, 0), g);
  const swapped = placeFighter(pack, g, newcomer, 1, 1);
  assert.equal(swapped.bands[0].slots[1], newcomer);
});

test("plans: only cards the class can use, three at most, and back to default", () => {
  let g = newGame(pack, 1);
  const knight = g.fighters.find((f) => f.cls === "knight");
  g = setPlan(pack, g, knight.id, ["heal-hurt", "hit-big", "hit-big", "hit-near", "hit-hurt", "hit-best"]);
  const plan = g.fighters.find((f) => f.id === knight.id).plan;
  assert.deepEqual(plan, ["hit-big", "hit-near", "hit-hurt"]);
  g = resetPlan(pack, g, knight.id);
  assert.deepEqual(g.fighters.find((f) => f.id === knight.id).plan, pack.classes.knight.plan);
});

test("coins buy friends and gear, and never go below zero", () => {
  let g = structuredClone(newGame(pack, 1));
  assert.equal(recruit(pack, g, "bard"), g, "nobody offers a bard yet");
  g.lit.push("pebble");
  assert.ok(offers(pack, g).includes("archer"));
  g.coins = hireCost(pack, g, "archer") - 1;
  assert.equal(recruit(pack, g, "archer"), g, "too few coins");
  g.coins = hireCost(pack, g, "archer");
  const hired = recruit(pack, g, "archer");
  assert.equal(hired.coins, 0);
  assert.equal(hired.fighters.length, g.fighters.length + 1);
  const rich = { ...hired, coins: 100 };
  const geared = buyGear(pack, rich, "stick", rich.fighters[0].id);
  assert.equal(geared.fighters[0].gear, "stick");
  assert.equal(geared.coins, 100 - pack.gear.stick.cost);
  assert.equal(buyGear(pack, { ...hired, coins: 1 }, "stick", hired.fighters[0].id).coins, 1);
});

test("the band grows: more bands from forts, bigger bands from lanterns", () => {
  const g = structuredClone(newGame(pack, 1));
  g.lit.push("pebble", "mill", "moss");
  assert.equal(maxSize(g), 4);
  assert.equal(maxBands(pack, g), 3);
  g.lit.push("fern", "honey", "plum", "owl");
  assert.equal(maxSize(g), 5);
  assert.equal(maxBands(pack, g), 4);
});

test("a beaten captain wakes up and joins the band", () => {
  let g = structuredClone(newGame(pack, 1));
  const foe = g.gloom.find((b) => b.id === "g-moss");
  for (const u of foe.units) u.hp = 1;
  foe.yawns = YAWN_LIMIT;
  g.lit.push("pebble");
  g.bands[0].at = "pebble";
  g.bands[0].to = "moss";
  const before = g.fighters.length;
  g = finishBattle(pack, endTurn(pack, g));
  assert.equal(g.fighters.length, before + 1);
  assert.ok(g.fighters.at(-1).captain);
  assert.ok(g.lit.includes("moss"));
  assert.ok(g.bands.length >= 3, "the fort opens a new band");
});

test("lighting the great lantern wins and nothing runs after it", () => {
  const g = keepOpen();
  g.gloom = [];
  g.bands[0].at = "cloud";
  g.bands[0].to = "keep";
  const won = endTurn(pack, g);
  assert.equal(won.phase, "won");
  assert.equal(endTurn(pack, won), won);
  assert.equal(planMove(pack, won, 1, "cloud"), won);
});
