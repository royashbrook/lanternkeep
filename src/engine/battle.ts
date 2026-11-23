// battles play themselves: seeded, deterministic, and always over within MAX_ROUNDS.
import { roll } from "./rng.ts";
import type { BattleEvent, BattleLog, CardDef, ClassDef, Fielder, GearDef, Pack } from "./types.ts";

/** the guaranteed end. when the rounds run out everyone gets sleepy and the side with more
 * of its strength left wins, the player on a tie */
export const MAX_ROUNDS = 8;
/** a card meant for the hurt only fires below this much health */
const HURT = 0.8;
const STRONG = 1.5;
/** a front-row fighter stuck in the back row does not hit as hard */
const BACK_ROW = 0.65;
const SPLASH = 0.5;
const GUARD = 0.7;
const MAX_CHEER = 3;

export const rowOf = (slot: number) => (slot < 3 ? 0 : 1);
export const colOf = (slot: number) => slot % 3;

export function statsOf(cls: ClassDef, level: number, gear?: GearDef | null) {
  const up = level - 1;
  return {
    max: Math.round(cls.hp * (1 + 0.17 * up)) + (gear?.hp ?? 0),
    power: Math.round(cls.power * (1 + 0.15 * up)) + (gear?.power ?? 0),
    speed: cls.speed + (gear?.speed ?? 0),
  };
}

/** a gloomling's numbers: its class at its level, scaled by the pack */
export function foeStats(pack: Pack, foe: string, level: number) {
  const stats = statsOf(pack.classes[pack.foes[foe].as], level);
  return {
    max: Math.max(1, Math.round(stats.max * pack.foeScale.hp)),
    power: Math.max(1, Math.round(stats.power * pack.foeScale.power)),
    speed: stats.speed,
  };
}

interface Live extends Fielder {
  i: number;
  boost: number;
  hushed: boolean;
  charged: boolean;
  guarded: boolean;
}

export function fight(pack: Pack, band: Fielder[], gloom: Fielder[], seed: number): BattleLog {
  const units: Fielder[] = [...band, ...gloom].map((u) => ({ ...u, plan: [...u.plan] }));
  const live: Live[] = units.map((u, i) => ({ ...u, plan: [...u.plan], i, boost: 0, hushed: false, charged: false, guarded: false }));
  const events: BattleEvent[] = [];
  let dice = seed >>> 0;
  const rand = () => {
    const [value, next] = roll(dice);
    dice = next;
    return value;
  };
  const up = (side: Fielder["side"]) => live.filter((u) => u.side === side && u.hp > 0);
  const other = (u: Live): Fielder["side"] => (u.side === "band" ? "gloom" : "band");
  const over = () => up("band").length === 0 || up("gloom").length === 0;
  const ratio = (u: Live) => u.hp / u.max;

  function reachable(u: Live, c: ClassDef) {
    const foes = up(other(u));
    if (c.reach === "any" || (c.charge && !u.charged)) return foes;
    const front = foes.filter((f) => rowOf(f.slot) === 0);
    return front.length ? front : foes;
  }
  /** nearest column first, then the front row, then the lowest spot, so it never needs a dice roll */
  const nearest = (u: Live, list: Live[]) =>
    [...list].sort(
      (a, b) =>
        Math.abs(colOf(a.slot) - colOf(u.slot)) - Math.abs(colOf(b.slot) - colOf(u.slot)) ||
        rowOf(a.slot) - rowOf(b.slot) ||
        a.slot - b.slot,
    )[0];
  const lowest = (list: Live[]) => [...list].sort((a, b) => ratio(a) - ratio(b) || a.slot - b.slot)[0];

  function aim(u: Live, c: ClassDef, card: CardDef): Live | Live[] | null {
    if (card.act === "hit") {
      const can = reachable(u, c);
      if (!can.length) return null;
      switch (card.pick) {
        case "near":
          return nearest(u, can);
        case "flyer": {
          const list = can.filter((f) => pack.classes[f.cls].flies);
          return list.length ? nearest(u, list) : null;
        }
        case "hurt": {
          const list = can.filter((f) => f.hp < f.max);
          return list.length ? lowest(list) : null;
        }
        case "big":
          return [...can].sort((a, b) => b.hp - a.hp || a.slot - b.slot)[0];
        case "back": {
          const list = can.filter((f) => rowOf(f.slot) === 1);
          return list.length ? nearest(u, list) : null;
        }
        case "front": {
          const list = can.filter((f) => rowOf(f.slot) === 0);
          return list.length ? nearest(u, list) : null;
        }
        case "best": {
          const list = can.filter((f) => c.beats.includes(f.cls));
          return list.length ? nearest(u, list) : null;
        }
        default:
          return null;
      }
    }
    const friends = up(u.side);
    if (card.act === "heal") {
      const hurt = friends.filter((f) => ratio(f) < HURT);
      if (card.pick === "self") return ratio(u) < HURT ? u : null;
      if (card.pick === "front") {
        const list = hurt.filter((f) => rowOf(f.slot) === 0);
        return list.length ? lowest(list) : null;
      }
      return hurt.length ? lowest(hurt) : null;
    }
    if (card.act === "cheer") {
      const list = friends.filter((f) => f.boost < MAX_CHEER);
      return list.length ? list : null;
    }
    // hush: the biggest one still awake
    const awake = up(other(u)).filter((f) => !f.hushed);
    return awake.length ? [...awake].sort((a, b) => b.power - a.power || a.slot - b.slot)[0] : null;
  }

  function strike(u: Live, c: ClassDef, target: Live, part: number, splash: boolean) {
    let to = target;
    let guarded = false;
    // a guard steps in for the friend right behind it. magic and splashes go round
    if (!splash && !c.splash && rowOf(to.slot) === 1) {
      const guard = up(to.side).find((f) => pack.classes[f.cls].guards && rowOf(f.slot) === 0 && colOf(f.slot) === colOf(to.slot) && !f.guarded);
      if (guard) {
        guard.guarded = true;
        to = guard;
        guarded = true;
      }
    }
    const strong = c.beats.includes(to.cls);
    const melee = c.reach === "front" && rowOf(u.slot) === 1;
    const raw = (u.power + u.boost) * (strong ? STRONG : 1) * (melee ? BACK_ROW : 1) * part * (guarded ? GUARD : 1) * (0.9 + rand() * 0.2);
    const n = Math.max(1, Math.round(raw));
    to.hp = Math.max(0, to.hp - n);
    events.push({ t: "hit", by: u.i, to: to.i, n, hp: to.hp, strong, guarded, splash });
    if (to.hp === 0) events.push({ t: "down", who: to.i });
  }

  function act(u: Live) {
    const c = pack.classes[u.cls];
    let card: CardDef | null = null;
    let target: Live | Live[] | null = null;
    for (const id of u.plan) {
      const candidate = pack.cards[id];
      if (!candidate) continue;
      target = aim(u, c, candidate);
      if (target) {
        card = candidate;
        break;
      }
    }
    if (!card || !target) {
      // nobody ever just stands there: with no card that fits, a plain bonk
      const can = reachable(u, c);
      if (!can.length) return;
      target = nearest(u, can);
      events.push({ t: "think", by: u.i, card: null });
      strike(u, c, target, 1, false);
      u.charged = true;
      return;
    }
    events.push({ t: "think", by: u.i, card: card.id });
    if (card.act === "hit") {
      const main = target as Live;
      strike(u, c, main, 1, false);
      u.charged = true;
      if (c.splash && !over()) {
        const side = up(main.side).filter((f) => f !== main && rowOf(f.slot) === rowOf(main.slot) && Math.abs(colOf(f.slot) - colOf(main.slot)) === 1);
        if (side.length) strike(u, c, nearest(main, side), SPLASH, true);
      }
    } else if (card.act === "heal") {
      const to = target as Live;
      const amount = (c.heal ?? 6) + (u.level - 1) * 2;
      const n = Math.min(amount, to.max - to.hp);
      to.hp += n;
      events.push({ t: "heal", by: u.i, to: to.i, n, hp: to.hp });
    } else if (card.act === "cheer") {
      const list = target as Live[];
      for (const f of list) f.boost += 1;
      events.push({ t: "cheer", by: u.i, to: list.map((f) => f.i) });
    } else {
      const to = target as Live;
      to.hushed = true;
      events.push({ t: "hush", by: u.i, to: to.i });
    }
  }

  let round = 0;
  while (round < MAX_ROUNDS && !over()) {
    round++;
    events.push({ t: "round", n: round });
    for (const u of live) u.guarded = false;
    const order = live
      .filter((u) => u.hp > 0)
      .map((u) => ({ u, tie: rand() }))
      .sort((a, b) => b.u.speed - a.u.speed || a.tie - b.tie)
      .map((x) => x.u);
    for (const u of order) {
      if (u.hp <= 0) continue;
      if (u.hushed) {
        u.hushed = false;
        events.push({ t: "snooze", who: u.i });
        continue;
      }
      act(u);
      if (over()) break;
    }
  }

  const timedOut = !over();
  let win: boolean;
  if (timedOut) {
    const share = (side: Fielder["side"]) => {
      const list = live.filter((u) => u.side === side);
      return list.reduce((sum, u) => sum + u.hp, 0) / list.reduce((sum, u) => sum + u.max, 0);
    };
    win = share("band") >= share("gloom");
    events.push({ t: "sleepy" });
    for (const u of up(win ? "gloom" : "band")) {
      u.hp = 0;
      events.push({ t: "down", who: u.i });
    }
  } else win = up("gloom").length > 0 ? false : true;
  events.push({ t: "end", win });
  return { units, events, win, rounds: round, hp: live.map((u) => u.hp), timedOut };
}
