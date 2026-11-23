// the map game. every function takes a game and hands back a new one: nothing here
// keeps state of its own, so a save is simply the game.
import { fight, foeStats, statsOf } from "./battle.ts";
import { mix } from "./rng.ts";
import type { Band, BattleLog, Fielder, Fighter, Game, GloomBand, Meet, News, Pack } from "./types.ts";

export const MAX_BANDS = 4;
export const MAX_SIZE = 5;
export const MAX_LEVEL = 9;
export const MAX_PLAN = 3;
/** how many friends you can hire up to. captains who wake up still join past it */
export const MAX_FIGHTERS = 40;
/** a band that has beaten you this many times is too sleepy to fight at all */
export const YAWN_LIMIT = 4;
const YAWN_SHARE = 0.25;

const clone = (g: Game): Game => structuredClone(g);

export const neighbours = (pack: Pack, id: string) =>
  pack.roads.flatMap(([a, b]) => (a === id ? [b] : b === id ? [a] : []));
export const placeOf = (pack: Pack, id: string) => pack.places.find((p) => p.id === id)!;
export const fightersIn = (g: Game, band: Band) =>
  band.slots.flatMap((id) => (id === null ? [] : g.fighters.filter((f) => f.id === id)));
export const xpNeeded = (level: number) => 24 + level * 12;
export const isLit = (g: Game, id: string) => g.lit.includes(id);

export const maxBands = (pack: Pack, g: Pick<Game, "lit">) =>
  Math.min(MAX_BANDS, pack.start.bands.length + g.lit.filter((id) => placeOf(pack, id).kind === "fort").length);
export const maxSize = (g: Pick<Game, "lit">) => Math.min(MAX_SIZE, 3 + Math.floor((g.lit.length - 1) / 3));

function makeFighter(pack: Pack, id: number, name: string, cls: string, level = 1, captain = false): Fighter {
  const f: Fighter = { id, name, cls, level, xp: 0, gear: null, plan: [...pack.classes[cls].plan] };
  if (captain) f.captain = true;
  return f;
}

export function newGame(pack: Pack, seed: number): Game {
  let nextId = 1;
  const fighters: Fighter[] = [];
  const bands: Band[] = pack.start.bands.map((b, i) => {
    const slots: (number | null)[] = [null, null, null, null, null, null];
    for (const s of b.fighters) {
      const f = makeFighter(pack, nextId++, s.name, s.cls);
      fighters.push(f);
      slots[s.slot] = f.id;
    }
    return { id: i + 1, name: b.name, at: pack.home, to: null, slots };
  });
  const gloom: GloomBand[] = pack.gloom.map((d) => ({
    id: d.id,
    at: d.at,
    to: null,
    step: 0,
    yawns: 0,
    units: d.units.map((u) => ({ ...u, hp: foeStats(pack, u.foe, u.level).max })),
  }));
  const g: Game = {
    v: 1,
    pack: pack.id,
    seed: seed >>> 0,
    turn: 1,
    coins: pack.start.coins,
    lit: [pack.home],
    fighters,
    bands,
    gloom,
    queue: [],
    phase: "plan",
    after: "gloom",
    fights: 0,
    nextId,
    hired: 0,
    news: [],
    stats: { wins: 0, naps: 0, poofs: 0 },
  };
  setIntents(pack, g);
  return g;
}

/** where each gloom band will walk next. two never aim for the same place, and they keep out of the home town */
function setIntents(pack: Pack, g: Game) {
  const taken = new Set(g.gloom.map((b) => b.at));
  for (const b of g.gloom) {
    const route = pack.gloom.find((d) => d.id === b.id)!.route;
    b.to = null;
    if (route.length < 2) continue;
    const next = route[(b.step + 1) % route.length];
    if (next === pack.home || taken.has(next) || !neighbours(pack, b.at).includes(next)) continue;
    b.to = next;
    taken.delete(b.at);
    taken.add(next);
  }
}

/** the great lantern's door opens once every other lantern is lit, so the last battle comes last */
export const goalOpen = (pack: Pack, g: Pick<Game, "lit">) => pack.places.every((p) => p.id === pack.goal || g.lit.includes(p.id));

export function movesFor(pack: Pack, g: Game, bandId: number): string[] {
  const band = g.bands.find((b) => b.id === bandId);
  if (!band || g.phase !== "plan" || !band.slots.some((s) => s !== null)) return [];
  return neighbours(pack, band.at).filter((id) => id !== pack.goal || goalOpen(pack, g));
}

/** plan a walk, or pass null (or the band's own place) to stay */
export function planMove(pack: Pack, g: Game, bandId: number, to: string | null): Game {
  if (g.phase !== "plan") return g;
  const n = clone(g);
  const band = n.bands.find((b) => b.id === bandId);
  if (!band) return g;
  if (to === null || to === band.at) band.to = null;
  else if (movesFor(pack, n, bandId).includes(to)) band.to = to;
  else return g;
  return n;
}

function light(pack: Pack, g: Game, id: string) {
  if (isLit(g, id)) return;
  const beforeBands = maxBands(pack, g);
  const beforeSize = maxSize(g);
  g.lit.push(id);
  const place = placeOf(pack, id);
  g.coins += place.gift;
  g.news.push({ k: "lit", place: id, coins: place.gift });
  const bands = maxBands(pack, g);
  if (bands > beforeBands) {
    while (g.bands.length < bands) {
      const i = g.bands.length;
      g.bands.push({ id: i + 1, name: pack.bandNames[i - pack.start.bands.length] ?? `Band ${i + 1}`, at: pack.home, to: null, slots: [null, null, null, null, null, null] });
    }
    g.news.push({ k: "bands", count: bands });
  }
  const size = maxSize(g);
  if (size > beforeSize) g.news.push({ k: "size", count: size });
  if (id === pack.goal) {
    g.phase = "won";
    g.queue = [];
    g.news.push({ k: "won" });
  }
}

/** bands on a place with gloom meet it; a band on a free dark place lights it */
function arrive(pack: Pack, g: Game) {
  for (const band of g.bands) {
    if (!band.slots.some((s) => s !== null)) continue;
    const foe = g.gloom.find((b) => b.at === band.at);
    if (foe) {
      if (!g.queue.some((m) => m.band === band.id && m.gloom === foe.id)) g.queue.push({ band: band.id, gloom: foe.id });
    } else if (!isLit(g, band.at)) {
      light(pack, g, band.at);
      if (g.phase === "won") return;
    }
  }
}

function settle(pack: Pack, g: Game): Game {
  for (;;) {
    if ((g.phase as Game["phase"]) === "won") return g;
    // drop meetings that no longer make sense: the gloom band is gone or the band walked home
    g.queue = g.queue.filter((m) => {
      const foe = g.gloom.find((b) => b.id === m.gloom);
      const band = g.bands.find((b) => b.id === m.band);
      return !!foe && !!band && foe.at === band.at;
    });
    if (g.queue.length) {
      g.phase = "battle";
      return g;
    }
    if (g.after === "gloom") {
      g.after = "turn";
      for (const b of g.gloom) {
        if (b.to) {
          b.at = b.to;
          b.step += 1;
          b.to = null;
        }
      }
      arrive(pack, g);
      continue;
    }
    g.turn += 1;
    g.after = "gloom";
    g.phase = "plan";
    for (const id of g.lit) g.coins += placeOf(pack, id).income;
    setIntents(pack, g);
    return g;
  }
}

export function endTurn(pack: Pack, g: Game): Game {
  if (g.phase !== "plan") return g;
  const n = clone(g);
  n.after = "gloom";
  for (const b of n.bands) {
    if (b.to && movesFor(pack, n, b.id).includes(b.to)) b.at = b.to;
    b.to = null;
  }
  arrive(pack, n);
  return settle(pack, n);
}

function fielders(pack: Pack, g: Game, m: Meet): { band: Fielder[]; gloom: Fielder[] } {
  const b = g.bands.find((x) => x.id === m.band)!;
  const foe = g.gloom.find((x) => x.id === m.gloom)!;
  const band: Fielder[] = [];
  b.slots.forEach((id, slot) => {
    if (id === null) return;
    const f = g.fighters.find((x) => x.id === id)!;
    const stats = statsOf(pack.classes[f.cls], f.level, f.gear ? pack.gear[f.gear] : null);
    const unit: Fielder = { side: "band", slot, cls: f.cls, name: f.name, level: f.level, max: stats.max, hp: stats.max, power: stats.power, speed: stats.speed, plan: [...f.plan], ref: f.id };
    if (f.captain) unit.captain = true;
    band.push(unit);
  });
  const sleepy = Math.max(0, 1 - foe.yawns * YAWN_SHARE);
  const gloom: Fielder[] = [];
  foe.units.forEach((u, index) => {
    if (u.hp <= 0) return;
    const def = pack.foes[u.foe];
    const c = pack.classes[def.as];
    const stats = foeStats(pack, u.foe, u.level);
    gloom.push({ side: "gloom", slot: u.slot, cls: def.as, name: def.name, level: u.level, max: stats.max, hp: Math.max(1, Math.min(u.hp, Math.round(stats.max * sleepy))), power: stats.power, speed: stats.speed, plan: [...c.plan], ref: index, foe: u.foe });
  });
  return { band, gloom };
}

/** the battle at the front of the queue, worked out fresh: the same game always gets the same battle,
 * so a reload in the middle simply watches it again */
export function currentBattle(pack: Pack, g: Game): BattleLog | null {
  const m = g.queue[0];
  if (g.phase !== "battle" || !m) return null;
  const foe = g.gloom.find((b) => b.id === m.gloom);
  if (!foe) return null;
  const { band, gloom } = fielders(pack, g, m);
  const seed = mix(g.seed, g.fights, 7919);
  if (foe.yawns >= YAWN_LIMIT) {
    // too sleepy to fight: they yawn, curl up and poof
    const units = [...band, ...gloom];
    const events: BattleLog["events"] = [{ t: "round", n: 1 }, { t: "sleepy" }];
    units.forEach((u, i) => {
      if (u.side === "gloom") events.push({ t: "down", who: i });
    });
    events.push({ t: "end", win: true });
    return { units, events, win: true, rounds: 1, hp: units.map((u) => (u.side === "gloom" ? 0 : u.hp)), timedOut: false };
  }
  return fight(pack, band, gloom, seed);
}

/** the shortest walk from a place to the nearest lit town with no gloom in it. home always qualifies */
export function safePlace(pack: Pack, g: Game, from: string): string {
  const seen = new Set([from]);
  let ring = [from];
  while (ring.length) {
    const hit = pack.places.find((p) => ring.includes(p.id) && isLit(g, p.id) && !g.gloom.some((b) => b.at === p.id));
    if (hit) return hit.id;
    const next: string[] = [];
    for (const id of ring) for (const n of neighbours(pack, id)) if (!seen.has(n)) (seen.add(n), next.push(n));
    ring = next;
  }
  return pack.home;
}

function grow(pack: Pack, g: Game, f: Fighter, amount: number) {
  if (f.level >= MAX_LEVEL) return;
  f.xp += amount;
  while (f.level < MAX_LEVEL && f.xp >= xpNeeded(f.level)) {
    f.xp -= xpNeeded(f.level);
    f.level += 1;
    g.news.push({ k: "level", fighter: f.id, level: f.level });
  }
  if (f.level >= MAX_LEVEL) f.xp = 0;
}

/** what the player gets for the battle at the front of the queue */
export function rewardFor(pack: Pack, g: Game, log: BattleLog) {
  const foes = log.units.filter((u) => u.side === "gloom");
  const top = foes.reduce((n, u) => Math.max(n, u.level), 1);
  return log.win ? { xp: 16 + top * 6, coins: 6 + foes.length * 3 } : { xp: 10 + top * 2, coins: 4 };
}

/** apply the battle at the front of the queue, once, and move on */
export function finishBattle(pack: Pack, g: Game): Game {
  if (g.phase !== "battle" || !g.queue.length) return g;
  const log = currentBattle(pack, g);
  const n = clone(g);
  const m = n.queue.shift()!;
  n.fights += 1;
  if (!log) return settle(pack, n);
  const band = n.bands.find((b) => b.id === m.band)!;
  const foe = n.gloom.find((b) => b.id === m.gloom)!;
  const reward = rewardFor(pack, g, log);
  n.coins += reward.coins;
  for (const f of fightersIn(n, band)) grow(pack, n, f, reward.xp);
  const poofed = log.units.filter((u, i) => u.side === "gloom" && log.hp[i] === 0).length;
  n.stats.poofs += poofed;
  if (log.win) {
    n.stats.wins += 1;
    n.gloom = n.gloom.filter((b) => b.id !== foe.id);
    // the lantern first: a fort can open the new band this captain is about to sit in
    if (!isLit(n, band.at)) light(pack, n, band.at);
    const captain = pack.gloom.find((d) => d.id === foe.id)?.captain;
    if (captain) {
      const f = makeFighter(pack, n.nextId++, captain.name, captain.cls, Math.max(captain.level, 1), true);
      n.fighters.push(f);
      seat(n, f);
      n.news.push({ k: "joined", fighter: f.id });
    }
  } else {
    n.stats.naps += 1;
    // the gloom keeps its bruises and gets sleepier, so every try counts
    log.units.forEach((u, i) => {
      if (u.side === "gloom") foe.units[u.ref].hp = Math.min(u.hp, log.hp[i]);
    });
    foe.units = foe.units.filter((u) => u.hp > 0);
    foe.yawns += 1;
    band.at = safePlace(pack, n, band.at);
    band.to = null;
    n.news.push({ k: "home", band: band.id, place: band.at });
  }
  return settle(pack, n);
}

/** a new friend sits in the first band with room, else waits in camp */
function seat(g: Game, f: Fighter) {
  const size = maxSize(g);
  const order = [1, 4, 0, 2, 3, 5];
  for (const band of g.bands) {
    if (band.slots.filter((s) => s !== null).length >= size) continue;
    const slot = order.find((s) => band.slots[s] === null);
    if (slot === undefined) continue;
    band.slots[slot] = f.id;
    return;
  }
}

export function clearNews(g: Game): Game {
  if (!g.news.length) return g;
  return { ...g, news: [] };
}

/** classes on offer: one from each lit place */
export function offers(pack: Pack, g: Game): string[] {
  const list: string[] = [];
  for (const p of pack.places) if (p.recruit && isLit(g, p.id) && !list.includes(p.recruit)) list.push(p.recruit);
  return list;
}

export const hireCost = (pack: Pack, g: Game, cls: string) => {
  const extra = Math.max(0, g.fighters.length - 6);
  return pack.classes[cls].cost + extra * 5;
};

export function recruit(pack: Pack, g: Game, cls: string): Game {
  if (g.phase !== "plan" || !offers(pack, g).includes(cls) || g.fighters.length >= MAX_FIGHTERS) return g;
  const cost = hireCost(pack, g, cls);
  if (g.coins < cost) return g;
  const n = clone(g);
  n.coins -= cost;
  const name = pack.names[n.hired % pack.names.length];
  n.hired += 1;
  const top = n.fighters.reduce((sum, f) => sum + f.level, 0) / n.fighters.length;
  const f = makeFighter(pack, n.nextId++, name, cls, Math.max(1, Math.floor(top)));
  n.fighters.push(f);
  seat(n, f);
  return n;
}

export function buyGear(pack: Pack, g: Game, gearId: string, fighterId: number): Game {
  const item = pack.gear[gearId];
  const f = g.fighters.find((x) => x.id === fighterId);
  if (g.phase !== "plan" || !item || !f || f.gear === gearId || g.coins < item.cost) return g;
  const n = clone(g);
  n.coins -= item.cost;
  n.fighters.find((x) => x.id === fighterId)!.gear = gearId;
  return n;
}

/** a band that is out on the map keeps at least one fighter in it, unless another band still has one */
const filled = (g: Game) => g.bands.filter((b) => b.slots.some((s) => s !== null)).length;

/** move a fighter to a spot in a band, or to camp with band null. whoever is there swaps places */
export function placeFighter(pack: Pack, g: Game, fighterId: number, bandId: number | null, slot: number): Game {
  if (g.phase !== "plan" || !g.fighters.some((f) => f.id === fighterId)) return g;
  const n = clone(g);
  const from = n.bands.find((b) => b.slots.includes(fighterId)) ?? null;
  const fromSlot = from ? from.slots.indexOf(fighterId) : -1;
  if (bandId === null) {
    if (!from) return g;
    from.slots[fromSlot] = null;
  } else {
    const to = n.bands.find((b) => b.id === bandId);
    if (!to || !Number.isInteger(slot) || slot < 0 || slot > 5) return g;
    const there = to.slots[slot];
    if (there === fighterId) return g;
    const count = to.slots.filter((s) => s !== null).length;
    if (there === null && to !== from && count >= maxSize(n)) return g;
    if (from) from.slots[fromSlot] = there;
    to.slots[slot] = fighterId;
  }
  // nobody can empty the whole field
  if (filled(n) === 0) return g;
  for (const b of n.bands) if (!b.slots.some((s) => s !== null)) b.to = null;
  return n;
}

export function setPlan(pack: Pack, g: Game, fighterId: number, plan: string[]): Game {
  const f = g.fighters.find((x) => x.id === fighterId);
  if (!f) return g;
  const allowed = pack.classes[f.cls].cards;
  const clean = [...new Set(plan)].filter((id) => allowed.includes(id)).slice(0, MAX_PLAN);
  const n = clone(g);
  n.fighters.find((x) => x.id === fighterId)!.plan = clean;
  return n;
}

export const resetPlan = (pack: Pack, g: Game, fighterId: number) => {
  const f = g.fighters.find((x) => x.id === fighterId);
  return f ? setPlan(pack, g, fighterId, pack.classes[f.cls].plan) : g;
};

export type { News };
