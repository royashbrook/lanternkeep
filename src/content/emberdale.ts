// the first region. every word a player reads about the world lives here, so a
// different pack is a different game on the same rules.
import type { CardDef, ClassDef, FoeDef, GearDef, Pack } from "../engine/types.ts";

const cards: CardDef[] = [
  { id: "hit-near", words: "hit the closest one", act: "hit", pick: "near" },
  { id: "hit-best", words: "hit who I am strong against", act: "hit", pick: "best" },
  { id: "hit-flyer", words: "hit flyers first", act: "hit", pick: "flyer" },
  { id: "hit-hurt", words: "hit whoever is most hurt", act: "hit", pick: "hurt" },
  { id: "hit-big", words: "hit the biggest one", act: "hit", pick: "big" },
  { id: "hit-back", words: "hit the back row", act: "hit", pick: "back" },
  { id: "hit-front", words: "hit the front row", act: "hit", pick: "front" },
  { id: "heal-hurt", words: "heal whoever is hurt most", act: "heal", pick: "hurt" },
  { id: "heal-front", words: "heal the front row first", act: "heal", pick: "front" },
  { id: "heal-self", words: "heal me if I am hurt", act: "heal", pick: "self" },
  { id: "sing-all", words: "sing to make everyone stronger", act: "cheer", pick: "all" },
  { id: "sing-hush", words: "sing a gloomling to sleep", act: "hush", pick: "big" },
];

const hits = ["hit-near", "hit-best", "hit-hurt", "hit-big", "hit-front"];
const classes: ClassDef[] = [
  { id: "knight", name: "knight", blurb: "guards the front, great at riders", hp: 36, power: 7, speed: 4, reach: "front", guards: true, beats: ["rider"], cards: hits, plan: ["hit-best", "hit-near"], cost: 45 },
  { id: "archer", name: "archer", blurb: "shoots anyone, great at flyers", hp: 21, power: 8, speed: 6, reach: "any", beats: ["flyer"], cards: ["hit-flyer", ...hits, "hit-back"], plan: ["hit-flyer", "hit-hurt", "hit-near"], cost: 40 },
  { id: "mage", name: "mage", blurb: "big magic that splashes, great at knights", hp: 18, power: 9, speed: 5, reach: "any", splash: true, beats: ["knight"], cards: [...hits, "hit-back"], plan: ["hit-best", "hit-big", "hit-near"], cost: 50 },
  { id: "healer", name: "healer", blurb: "makes hurt friends feel better", hp: 22, power: 3, speed: 5, reach: "front", heal: 10, beats: [], cards: ["heal-hurt", "heal-front", "heal-self", "hit-near"], plan: ["heal-hurt", "hit-near"], cost: 45 },
  { id: "rider", name: "rider", blurb: "charges in fast, great at archers and mages", hp: 27, power: 8, speed: 8, reach: "front", charge: true, beats: ["archer", "mage"], cards: hits, plan: ["hit-best", "hit-near"], cost: 50 },
  { id: "scout", name: "scout", blurb: "quick, and slips past the front row", hp: 19, power: 7, speed: 9, reach: "any", beats: [], cards: ["hit-back", ...hits], plan: ["hit-back", "hit-hurt", "hit-near"], cost: 35 },
  { id: "flyer", name: "flyer", blurb: "swoops over everyone", hp: 22, power: 7, speed: 7, reach: "any", flies: true, beats: [], cards: ["hit-hurt", ...hits.filter((c) => c !== "hit-hurt"), "hit-back"], plan: ["hit-hurt", "hit-near"], cost: 45 },
  { id: "bard", name: "bard", blurb: "sings to make friends stronger", hp: 21, power: 4, speed: 6, reach: "any", heal: 6, beats: [], cards: ["sing-all", "sing-hush", "heal-hurt", "hit-near"], plan: ["sing-all", "sing-hush", "hit-near"], cost: 40 },
];

const foes: FoeDef[] = [
  { id: "puff", name: "puffling", as: "knight" },
  { id: "drip", name: "dripling", as: "archer" },
  { id: "mumble", name: "mumbling", as: "mage" },
  { id: "snuffle", name: "snuffling", as: "healer" },
  { id: "bump", name: "bumpling", as: "rider" },
  { id: "wisp", name: "wispling", as: "scout" },
  { id: "flit", name: "flitling", as: "flyer" },
  { id: "hum", name: "humling", as: "bard" },
];

const gear: GearDef[] = [
  { id: "cap", name: "sturdy cap", blurb: "more health", hp: 10, cost: 30 },
  { id: "stick", name: "lucky stick", blurb: "hits harder", power: 3, cost: 35 },
  { id: "boots", name: "bouncy boots", blurb: "goes sooner", speed: 3, cost: 25 },
  { id: "cloak", name: "patchwork cloak", blurb: "lots more health", hp: 20, cost: 55 },
  { id: "charm", name: "ember charm", blurb: "hits a lot harder", power: 6, cost: 65 },
];

const byId = <T extends { id: string }>(list: T[]) => Object.fromEntries(list.map((x) => [x.id, x])) as Record<string, T>;

export const emberdale: Pack = {
  id: "emberdale",
  title: "Emberdale",
  classes: byId(classes),
  cards: byId(cards),
  foes: byId(foes),
  gear: byId(gear),
  places: [
    { id: "hollow", name: "Tinder Hollow", kind: "town", x: 95, y: 575, gift: 0, income: 6 },
    { id: "pebble", name: "Pebble Cross", kind: "town", x: 245, y: 385, gift: 20, income: 5, recruit: "archer" },
    { id: "mill", name: "Millbrook", kind: "town", x: 335, y: 600, gift: 25, income: 5, recruit: "knight" },
    { id: "fern", name: "Fernwatch", kind: "town", x: 130, y: 150, gift: 30, income: 5, recruit: "flyer" },
    { id: "honey", name: "Honeyfield", kind: "town", x: 540, y: 540, gift: 30, income: 6, recruit: "healer" },
    { id: "moss", name: "Mossgate Fort", kind: "fort", x: 415, y: 255, gift: 45, income: 6, recruit: "rider" },
    { id: "plum", name: "Plumtree", kind: "town", x: 690, y: 365, gift: 35, income: 6, recruit: "bard" },
    { id: "cloud", name: "Cloudstep", kind: "town", x: 640, y: 105, gift: 35, income: 6, recruit: "mage" },
    { id: "owl", name: "Owlwatch Fort", kind: "fort", x: 850, y: 565, gift: 50, income: 7, recruit: "scout" },
    { id: "keep", name: "The Lantern Keep", kind: "keep", x: 895, y: 170, gift: 0, income: 0 },
  ],
  roads: [
    ["hollow", "pebble"],
    ["hollow", "mill"],
    ["pebble", "mill"],
    ["pebble", "fern"],
    ["pebble", "moss"],
    ["fern", "moss"],
    ["mill", "honey"],
    ["moss", "honey"],
    ["moss", "cloud"],
    ["honey", "plum"],
    ["honey", "owl"],
    ["plum", "cloud"],
    ["plum", "owl"],
    ["plum", "keep"],
    ["cloud", "keep"],
    ["owl", "keep"],
  ],
  gloom: [
    { id: "g-mill", name: "the Millbrook puffs", at: "mill", route: ["mill"], units: [{ foe: "puff", slot: 1, level: 1 }, { foe: "wisp", slot: 4, level: 1 }] },
    { id: "g-fern", name: "the Fernwatch flutter", at: "fern", route: ["fern"], units: [{ foe: "flit", slot: 0, level: 2 }, { foe: "flit", slot: 2, level: 1 }, { foe: "puff", slot: 1, level: 1 }] },
    { id: "g-honey", name: "the wandering drips", at: "honey", route: ["honey", "plum", "honey", "mill"], units: [{ foe: "puff", slot: 1, level: 2 }, { foe: "drip", slot: 3, level: 2 }, { foe: "drip", slot: 5, level: 1 }] },
    {
      id: "g-moss", name: "the Mossgate guard", at: "moss", route: ["moss"],
      units: [{ foe: "puff", slot: 0, level: 2 }, { foe: "bump", slot: 2, level: 2 }, { foe: "mumble", slot: 4, level: 2 }, { foe: "drip", slot: 3, level: 1 }],
      captain: { name: "Captain Crumpet", cls: "knight", level: 3 },
    },
    { id: "g-plum", name: "the bumping bunch", at: "plum", route: ["plum", "cloud", "plum", "owl"], units: [{ foe: "bump", slot: 0, level: 3 }, { foe: "bump", slot: 2, level: 3 }, { foe: "hum", slot: 4, level: 3 }] },
    { id: "g-cloud", name: "the Cloudstep drift", at: "cloud", route: ["cloud"], units: [{ foe: "flit", slot: 0, level: 5 }, { foe: "puff", slot: 1, level: 4 }, { foe: "wisp", slot: 2, level: 4 }, { foe: "drip", slot: 3, level: 4 }, { foe: "mumble", slot: 5, level: 4 }] },
    {
      id: "g-owl", name: "the Owlwatch guard", at: "owl", route: ["owl"],
      units: [{ foe: "puff", slot: 1, level: 5 }, { foe: "bump", slot: 0, level: 5 }, { foe: "bump", slot: 2, level: 4 }, { foe: "drip", slot: 3, level: 5 }, { foe: "snuffle", slot: 5, level: 3 }],
      captain: { name: "Captain Nutmeg", cls: "mage", level: 4 },
    },
    {
      id: "g-keep", name: "the Great Yawn", at: "keep", route: ["keep"],
      units: [{ foe: "puff", slot: 0, level: 6 }, { foe: "bump", slot: 1, level: 7 }, { foe: "wisp", slot: 2, level: 6 }, { foe: "mumble", slot: 3, level: 6 }, { foe: "flit", slot: 4, level: 6 }, { foe: "hum", slot: 5, level: 6 }],
      captain: { name: "The Great Yawn", cls: "bard", level: 6 },
    },
  ],
  home: "hollow",
  goal: "keep",
  start: {
    coins: 40,
    bands: [
      { name: "Band of the Wick", fighters: [{ name: "Waffle", cls: "knight", slot: 1 }, { name: "Pickle", cls: "archer", slot: 3 }, { name: "Biscuit", cls: "healer", slot: 5 }] },
      { name: "Band of the Spark", fighters: [{ name: "Turnip", cls: "rider", slot: 1 }, { name: "Marble", cls: "mage", slot: 4 }, { name: "Acorn", cls: "scout", slot: 0 }] },
    ],
  },
  names: ["Dumpling", "Thimble", "Pudding", "Button", "Bramble", "Sprout", "Tumble", "Pepper", "Muffin", "Teacup", "Pretzel", "Noodle", "Gumdrop", "Sprocket", "Mitten", "Toffee"],
  bandNames: ["Band of the Glow", "Band of the Flame"],
  foeScale: { hp: 0.6, power: 0.62 },
};
