// a save is the game as json. nothing is trusted on the way back in: every field is checked
// against the pack, and anything that does not fit means the whole save is treated as unreadable,
// so the caller can keep it safe instead of playing on broken numbers.
import { foeStats } from "./battle.ts";
import { MAX_BANDS, MAX_LEVEL, MAX_PLAN, MAX_SIZE, neighbours } from "./campaign.ts";
import type { Band, Fighter, Game, GloomBand, GloomUnit, Meet, Pack } from "./types.ts";

export const SAVE_VERSION = 1;
const CODE_PREFIX = "LK1";

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const count = (x: unknown, min = 0, max = 1_000_000_000): x is number => Number.isInteger(x) && (x as number) >= min && (x as number) <= max;
const text = (x: unknown, max = 40): x is string => typeof x === "string" && x.length > 0 && x.length <= max;

function readFighter(pack: Pack, x: unknown): Fighter | null {
  if (!isObject(x) || !count(x.id, 1) || !text(x.name) || !text(x.cls) || !pack.classes[x.cls]) return null;
  if (!count(x.level, 1, MAX_LEVEL) || !count(x.xp)) return null;
  if (x.gear !== null && !(typeof x.gear === "string" && pack.gear[x.gear])) return null;
  if (!Array.isArray(x.plan) || x.plan.length > MAX_PLAN) return null;
  const allowed = pack.classes[x.cls].cards;
  if (!x.plan.every((id) => typeof id === "string" && allowed.includes(id))) return null;
  if (new Set(x.plan).size !== x.plan.length) return null;
  if (x.captain !== undefined && x.captain !== true) return null;
  const f: Fighter = { id: x.id, name: x.name, cls: x.cls, level: x.level, xp: x.xp, gear: x.gear as string | null, plan: [...(x.plan as string[])] };
  if (x.captain) f.captain = true;
  return f;
}

function readBand(pack: Pack, x: unknown, ids: Set<number>, used: Set<number>): Band | null {
  if (!isObject(x) || !count(x.id, 1) || !text(x.name) || !text(x.at)) return null;
  const at = x.at;
  if (!pack.places.some((p) => p.id === at)) return null;
  if (x.to !== null && !(typeof x.to === "string" && neighbours(pack, at).includes(x.to))) return null;
  if (!Array.isArray(x.slots) || x.slots.length !== 6) return null;
  const slots: (number | null)[] = [];
  for (const s of x.slots) {
    if (s === null) {
      slots.push(null);
      continue;
    }
    if (!count(s, 1) || !ids.has(s) || used.has(s)) return null;
    used.add(s);
    slots.push(s);
  }
  if (slots.filter((s) => s !== null).length > MAX_SIZE) return null;
  return { id: x.id, name: x.name, at, to: x.to as string | null, slots };
}

function readGloom(pack: Pack, x: unknown): GloomBand | null {
  if (!isObject(x) || !text(x.id) || !text(x.at) || !count(x.step) || !count(x.yawns)) return null;
  const at = x.at;
  if (!pack.gloom.some((d) => d.id === x.id) || !pack.places.some((p) => p.id === at) || at === pack.home) return null;
  if (x.to !== null && !(typeof x.to === "string" && x.to !== pack.home && neighbours(pack, at).includes(x.to))) return null;
  if (!Array.isArray(x.units) || x.units.length === 0 || x.units.length > 6) return null;
  const units: GloomUnit[] = [];
  const spots = new Set<number>();
  for (const u of x.units) {
    if (!isObject(u) || !text(u.foe) || !pack.foes[u.foe] || !count(u.slot, 0, 5) || !count(u.level, 1, MAX_LEVEL) || spots.has(u.slot)) return null;
    if (!count(u.hp, 1, foeStats(pack, u.foe, u.level).max)) return null;
    spots.add(u.slot);
    units.push({ foe: u.foe, slot: u.slot, level: u.level, hp: u.hp });
  }
  return { id: x.id as string, at, to: x.to as string | null, step: x.step, units, yawns: x.yawns };
}

/** a checked game, or null when the data is not a save this pack can trust */
export function checkGame(pack: Pack, x: unknown): Game | null {
  if (!isObject(x) || x.v !== SAVE_VERSION || x.pack !== pack.id) return null;
  if (!count(x.seed, 0, 0xffffffff) || !count(x.turn, 1) || !count(x.coins) || !count(x.fights) || !count(x.nextId, 1) || !count(x.hired)) return null;
  if (x.phase !== "plan" && x.phase !== "battle" && x.phase !== "won") return null;
  if (x.after !== "gloom" && x.after !== "turn") return null;
  if (!Array.isArray(x.lit) || !Array.isArray(x.fighters) || !Array.isArray(x.bands) || !Array.isArray(x.gloom) || !Array.isArray(x.queue)) return null;
  if (!x.lit.every((id) => typeof id === "string" && pack.places.some((p) => p.id === id))) return null;
  const lit = x.lit as string[];
  if (new Set(lit).size !== lit.length || !lit.includes(pack.home)) return null;

  const fighters: Fighter[] = [];
  for (const raw of x.fighters) {
    const f = readFighter(pack, raw);
    if (!f || fighters.some((o) => o.id === f.id) || f.id >= x.nextId) return null;
    fighters.push(f);
  }
  if (!fighters.length) return null;
  const ids = new Set(fighters.map((f) => f.id));
  const used = new Set<number>();
  const bands: Band[] = [];
  if (x.bands.length < 1 || x.bands.length > MAX_BANDS) return null;
  for (const raw of x.bands) {
    const b = readBand(pack, raw, ids, used);
    if (!b || bands.some((o) => o.id === b.id)) return null;
    bands.push(b);
  }
  if (!bands.some((b) => b.slots.some((s) => s !== null))) return null;

  const gloom: GloomBand[] = [];
  for (const raw of x.gloom) {
    const b = readGloom(pack, raw);
    if (!b || gloom.some((o) => o.id === b.id)) return null;
    gloom.push(b);
  }

  const queue: Meet[] = [];
  for (const m of x.queue) {
    if (!isObject(m) || !count(m.band, 1) || !text(m.gloom)) return null;
    const band = bands.find((b) => b.id === m.band);
    const foe = gloom.find((b) => b.id === m.gloom);
    if (!band || !foe || band.at !== foe.at || !band.slots.some((s) => s !== null)) return null;
    queue.push({ band: m.band as number, gloom: m.gloom as string });
  }
  if (x.phase === "battle" && !queue.length) return null;
  if (x.phase !== "battle" && queue.length) return null;
  if ((x.phase === "won") !== lit.includes(pack.goal)) return null;
  if (!isObject(x.stats) || !count(x.stats.wins) || !count(x.stats.naps) || !count(x.stats.poofs)) return null;

  return {
    v: SAVE_VERSION,
    pack: pack.id,
    seed: x.seed,
    turn: x.turn,
    coins: x.coins,
    lit: [...lit],
    fighters,
    bands,
    gloom,
    queue,
    phase: x.phase,
    after: x.after,
    fights: x.fights,
    nextId: x.nextId,
    hired: x.hired,
    // celebrations are not worth trusting from a file: a reload just skips them
    news: [],
    stats: { wins: x.stats.wins, naps: x.stats.naps, poofs: x.stats.poofs },
  };
}

export const toSave = (g: Game) => JSON.stringify({ ...g, news: [] });

export function fromSave(pack: Pack, raw: string | null): Game | null {
  if (!raw) return null;
  try {
    return checkGame(pack, JSON.parse(raw));
  } catch {
    return null;
  }
}

const ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function toBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1] ?? 0, c = bytes[i + 2] ?? 0;
    out += ABC[a >> 2] + ABC[((a & 3) << 4) | (b >> 4)];
    if (i + 1 < bytes.length) out += ABC[((b & 15) << 2) | (c >> 6)];
    if (i + 2 < bytes.length) out += ABC[c & 63];
  }
  return out;
}

function fromBase64(s: string): Uint8Array | null {
  if (s.length % 4 === 1) return null;
  const out = new Uint8Array(Math.floor((s.length * 3) / 4));
  let bits = 0, have = 0, at = 0;
  for (const ch of s) {
    const v = ABC.indexOf(ch);
    if (v < 0) return null;
    bits = ((bits << 6) | v) & 0xffff;
    have += 6;
    if (have >= 8) {
      have -= 8;
      out[at++] = (bits >> have) & 255;
    }
  }
  return out;
}

const sum = (s: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
};

/** the whole game as one line of text a grown-up can paste somewhere else */
export function toCode(g: Game): string {
  const body = toBase64(new TextEncoder().encode(toSave(g)));
  return `${CODE_PREFIX}.${body}.${sum(body)}`;
}

/** a game from a code, or null when the code is wrong, cut short or changed */
export function fromCode(pack: Pack, code: string): Game | null {
  const parts = code.replace(/\s+/g, "").split(".");
  if (parts.length !== 3 || parts[0] !== CODE_PREFIX || sum(parts[1]) !== parts[2]) return null;
  const bytes = fromBase64(parts[1]);
  if (!bytes) return null;
  try {
    return fromSave(pack, new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return null;
  }
}
