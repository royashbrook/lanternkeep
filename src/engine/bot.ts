// two players made of plain rules, both driving the real engine through the same calls the
// screen uses. the walker heads for the nearest dark lantern. the wanderer picks any legal move.
import { currentBattle, endTurn, finishBattle, isLit, movesFor, neighbours, newGame, planMove } from "./campaign.ts";
import { roll } from "./rng.ts";
import type { Game, Pack } from "./types.ts";

export interface BotRun {
  won: boolean;
  turns: number;
  battles: number;
  wins: number;
  naps: number;
  /** battles won only because the gloom band had grown too sleepy to fight */
  freeWins: number;
  lit: number;
}

function stepToward(pack: Pack, from: string, wanted: (id: string) => boolean): string | null {
  const back = new Map<string, string | null>([[from, null]]);
  let ring = [from];
  while (ring.length) {
    const next: string[] = [];
    for (const id of ring) {
      for (const n of neighbours(pack, id)) {
        if (back.has(n)) continue;
        back.set(n, id);
        if (wanted(n)) {
          let at = n;
          while (back.get(at) !== from) at = back.get(at)!;
          return at;
        }
        next.push(n);
      }
    }
    ring = next;
  }
  return null;
}

function walkerMoves(pack: Pack, g: Game): Game {
  let n = g;
  const claimed = new Set<string>();
  const finalReady = pack.places.filter((p) => p.id !== pack.goal).every((p) => isLit(g, p.id));
  for (const band of n.bands) {
    if (!movesFor(pack, n, band.id).length) continue;
    const wanted = (id: string) => !isLit(n, id) && !claimed.has(id) && (finalReady || id !== pack.goal);
    const to = stepToward(pack, band.at, wanted) ?? stepToward(pack, band.at, (id) => !isLit(n, id));
    if (to) {
      claimed.add(to);
      n = planMove(pack, n, band.id, to);
    }
  }
  return n;
}

function wandererMoves(pack: Pack, g: Game, dice: { s: number }): Game {
  let n = g;
  for (const band of n.bands) {
    const moves = movesFor(pack, n, band.id);
    if (!moves.length) continue;
    const [v, next] = roll(dice.s);
    dice.s = next;
    const choice = Math.floor(v * (moves.length + 1));
    if (choice < moves.length) n = planMove(pack, n, band.id, moves[choice]);
  }
  return n;
}

export function playBot(pack: Pack, seed: number, kind: "walker" | "wanderer", maxTurns = 1000): BotRun {
  let g = newGame(pack, seed);
  const dice = { s: (seed ^ 0x5eed) >>> 0 };
  let battles = 0;
  let freeWins = 0;
  while (g.phase !== "won" && g.turn <= maxTurns) {
    if (g.phase === "plan") {
      g = kind === "walker" ? walkerMoves(pack, g) : wandererMoves(pack, g, dice);
      g = endTurn(pack, g);
    } else if (g.phase === "battle") {
      const log = currentBattle(pack, g);
      if (!log) throw Error("a battle phase with no battle");
      battles += 1;
      if (log.win && !log.events.some((e) => e.t === "hit" || e.t === "think")) freeWins += 1;
      const before = g.fights;
      g = finishBattle(pack, g);
      if (g.fights !== before + 1) throw Error("a battle did not finish");
    }
    g = g.news.length ? { ...g, news: [] } : g;
  }
  return { won: g.phase === "won", turns: g.turn, battles, wins: g.stats.wins, naps: g.stats.naps, freeWins, lit: g.lit.length };
}
