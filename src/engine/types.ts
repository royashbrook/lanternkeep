// everything the engine needs to know about a world comes in a content pack, so the
// same rules can wear a different story. nothing in here touches the page.

export type Act = "hit" | "heal" | "cheer" | "hush";
/** how a card chooses: the closest, flyers, the most hurt, the biggest, the back row,
 * who this fighter is strong against, itself, the front row, or everyone */
export type Pick = "near" | "flyer" | "hurt" | "big" | "back" | "best" | "self" | "front" | "all";

export interface CardDef {
  id: string;
  /** the plain words on the card */
  words: string;
  act: Act;
  pick: Pick;
}

export interface ClassDef {
  id: string;
  name: string;
  /** one short line a child can read */
  blurb: string;
  hp: number;
  power: number;
  speed: number;
  /** "front" must get past the front row, "any" can reach anyone */
  reach: "front" | "any";
  flies?: boolean;
  /** steps in front of a hit meant for a friend behind */
  guards?: boolean;
  /** the hit splashes the one next to the target */
  splash?: boolean;
  /** the first hit of a battle can reach anyone */
  charge?: boolean;
  /** how much a healing card heals */
  heal?: number;
  /** classes this one hits extra hard */
  beats: string[];
  /** the cards this class can use, in the order they are offered */
  cards: string[];
  /** the good default plan */
  plan: string[];
  cost: number;
}

export interface FoeDef {
  id: string;
  name: string;
  /** the class it fights like */
  as: string;
}

export interface GearDef {
  id: string;
  name: string;
  blurb: string;
  hp?: number;
  power?: number;
  speed?: number;
  cost: number;
}

export interface PlaceDef {
  id: string;
  name: string;
  kind: "town" | "fort" | "keep";
  /** where it sits on a 1000 by 700 map */
  x: number;
  y: number;
  /** coins for lighting it */
  gift: number;
  /** coins each turn once lit */
  income: number;
  /** who can be hired once it is lit */
  recruit?: string;
}

export interface GloomUnitDef {
  foe: string;
  slot: number;
  level: number;
}

export interface GloomDef {
  id: string;
  name: string;
  at: string;
  /** places it walks through in a loop, starting at `at`. one stop means it stands guard */
  route: string[];
  units: GloomUnitDef[];
  /** who wakes up and joins when this band is beaten */
  captain?: { name: string; cls: string; level: number };
}

export interface StartFighter {
  name: string;
  cls: string;
  slot: number;
}

export interface Pack {
  id: string;
  title: string;
  classes: Record<string, ClassDef>;
  cards: Record<string, CardDef>;
  foes: Record<string, FoeDef>;
  gear: Record<string, GearDef>;
  places: PlaceDef[];
  roads: [string, string][];
  gloom: GloomDef[];
  /** the safe first town. the gloom can never walk in */
  home: string;
  /** the place whose lantern wins the region */
  goal: string;
  start: { coins: number; bands: { name: string; fighters: StartFighter[] }[] };
  /** names for the fighters you hire, used in order */
  names: string[];
  /** names for new bands */
  bandNames: string[];
  /** gloomlings fight like their class, at this share of its health and power */
  foeScale: { hp: number; power: number };
}

export interface Fighter {
  id: number;
  name: string;
  cls: string;
  level: number;
  xp: number;
  gear: string | null;
  plan: string[];
  captain?: boolean;
}

export interface Band {
  id: number;
  name: string;
  at: string;
  /** where it plans to walk this turn */
  to: string | null;
  /** six spots: 0 1 2 are the front row, 3 4 5 the back row. fighter ids */
  slots: (number | null)[];
}

export interface GloomUnit {
  foe: string;
  slot: number;
  level: number;
  hp: number;
}

export interface GloomBand {
  id: string;
  at: string;
  /** where it will walk next. shown on the map, and it always does what it shows */
  to: string | null;
  /** how far along its route it is */
  step: number;
  units: GloomUnit[];
  /** how many times it has beaten a band. each one makes it sleepier */
  yawns: number;
}

export interface Meet {
  band: number;
  gloom: string;
}

export type News =
  | { k: "lit"; place: string; coins: number }
  | { k: "joined"; fighter: number }
  | { k: "level"; fighter: number; level: number }
  | { k: "bands"; count: number }
  | { k: "size"; count: number }
  | { k: "home"; band: number; place: string }
  | { k: "won" };

export interface Game {
  v: 1;
  pack: string;
  seed: number;
  turn: number;
  coins: number;
  lit: string[];
  fighters: Fighter[];
  bands: Band[];
  gloom: GloomBand[];
  /** battles waiting to be watched, first one next */
  queue: Meet[];
  phase: "plan" | "battle" | "won";
  /** what happens when the queue runs out: the gloom walks, or a new turn starts */
  after: "gloom" | "turn";
  /** counts every battle, so each one has its own dice */
  fights: number;
  nextId: number;
  /** how many hired names are used */
  hired: number;
  news: News[];
  stats: { wins: number; naps: number; poofs: number };
}

export interface Fielder {
  side: "band" | "gloom";
  slot: number;
  cls: string;
  name: string;
  level: number;
  max: number;
  hp: number;
  power: number;
  speed: number;
  plan: string[];
  /** the fighter id, or the unit's index in its gloom band */
  ref: number;
  foe?: string;
  captain?: boolean;
}

export type BattleEvent =
  | { t: "round"; n: number }
  | { t: "think"; by: number; card: string | null }
  | { t: "hit"; by: number; to: number; n: number; hp: number; strong: boolean; guarded: boolean; splash: boolean }
  | { t: "heal"; by: number; to: number; n: number; hp: number }
  | { t: "cheer"; by: number; to: number[] }
  | { t: "hush"; by: number; to: number }
  | { t: "snooze"; who: number }
  | { t: "down"; who: number }
  | { t: "sleepy" }
  | { t: "end"; win: boolean };

export interface BattleLog {
  units: Fielder[];
  events: BattleEvent[];
  win: boolean;
  rounds: number;
  /** hit points when it ended, one per unit */
  hp: number[];
  /** true when the time limit decided it */
  timedOut: boolean;
}
