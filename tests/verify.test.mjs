import test from "node:test";
import assert from "node:assert/strict";
import { emberdale as pack } from "../src/content/emberdale.ts";
import { playBot } from "../src/engine/bot.ts";

// the real engine, a new game, the starting band and default plans: no recruits, no gear
test("a plain player wins the region on every seed, without any free wins", () => {
  for (let seed = 1; seed <= 500; seed++) {
    const run = playBot(pack, seed, "walker");
    assert.ok(run.won, `seed ${seed}`);
    assert.equal(run.freeWins, 0, `seed ${seed} leaned on a too-sleepy band`);
    assert.ok(run.turns <= 25, `seed ${seed} took ${run.turns} turns`);
  }
});

test("a child tapping at random still gets there", () => {
  for (let seed = 1; seed <= 300; seed++) assert.ok(playBot(pack, seed, "wanderer").won, `seed ${seed}`);
});

test("the same seed plays out the same", () => {
  assert.deepEqual(playBot(pack, 123, "walker"), playBot(pack, 123, "walker"));
  assert.deepEqual(playBot(pack, 123, "wanderer"), playBot(pack, 123, "wanderer"));
});
