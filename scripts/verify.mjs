// plays the real engine from a new game, with the starting band and its default plans,
// across many seeds. no recruits, no gear, no changed plans: if this wins, a child who ignores
// every menu can win too.
import { playBot } from "../src/engine/bot.ts";
import { emberdale } from "../src/content/emberdale.ts";

const SEEDS = Number(process.argv[2] || 2000);
const summarize = (kind) => {
  const runs = [];
  for (let seed = 1; seed <= SEEDS; seed++) runs.push(playBot(emberdale, seed, kind));
  const sum = (key) => runs.reduce((n, r) => n + r[key], 0);
  const worst = (key) => runs.reduce((n, r) => Math.max(n, r[key]), 0);
  return {
    kind,
    seeds: SEEDS,
    won: runs.filter((r) => r.won).length,
    turnsAvg: +(sum("turns") / SEEDS).toFixed(1),
    turnsMax: worst("turns"),
    battlesAvg: +(sum("battles") / SEEDS).toFixed(1),
    napsAvg: +(sum("naps") / SEEDS).toFixed(2),
    napsMax: worst("naps"),
    freeWinsTotal: sum("freeWins"),
    noNapRuns: runs.filter((r) => r.naps === 0).length,
  };
};
const walker = summarize("walker");
const wanderer = summarize("wanderer");
console.log(JSON.stringify(walker));
console.log(JSON.stringify(wanderer));
const failed = [];
if (walker.won !== SEEDS) failed.push(`the walker won ${walker.won} of ${SEEDS}`);
if (walker.freeWinsTotal !== 0) failed.push(`the walker needed ${walker.freeWinsTotal} free wins`);
if (wanderer.won !== SEEDS) failed.push(`the wanderer won ${wanderer.won} of ${SEEDS}`);
if (failed.length) {
  console.error(`FAIL: ${failed.join("; ")}`);
  process.exit(1);
}
console.log(`PASS: the region was won on all ${SEEDS} seeds by both bots`);
