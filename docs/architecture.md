# architecture note

**stage:** prototype, 0.x. working name only, local only, not published.

**shell profile:** puzzle / casual game. the title screen has one primary action. during play a
compact menu button replaces bottom navigation. orientation is `any`, with layouts for portrait and
landscape on tablet and phone.

**stack:** svelte 5, strict typescript, vite, playwright on chromium and webkit against the built
artifact. plain svelte, no sveltekit: this is a single screen app with no routes to prerender.

**renderer:** svg and css. the board and the figures are a small number of shapes that need real
buttons, focus and accessible names, so the dom fits better than a canvas.

## who owns what

| part | where | notes |
|---|---|---|
| rules | `src/engine/` | no dom. map turns, gloom intent, battles, plans, levels, coins, recruiting |
| saves | `src/engine/save.ts` | every field checked against the pack; save codes |
| a world | `src/content/emberdale.ts` | the content pack: classes, cards, foes, gear, places, roads, names, every world word |
| storage | `src/lib/saves.ts` | an unreadable save moves aside and is never written over |
| sound | `src/lib/sound.ts` | synthesized on demand, starts on a touch, nothing loaded |
| screens | `src/App.svelte`, `src/ui/` | svelte only presents; every change goes through an engine call |
| shell paint | `src/app.css` | theme tokens at the top, with a second theme to prove the reskin |

## rules that keep a child from getting stuck

- a battle is a pure function of the game, so a reload replays the same one and pays it once.
- a battle ends within `MAX_ROUNDS`. past that, the side with more strength left wins.
- a beaten band walks to the nearest lit town with no gloom in it. the home town can never be entered
  by the gloom, so one always exists.
- lit lanterns stay lit, and a gloom band keeps its bruises between tries.
- each time a gloom band wins it gets sleepier. after `YAWN_LIMIT` wins it cannot fight at all, so
  every band can be beaten eventually, however the player has set up.
- waiting a turn is always legal, and nobody can empty every band.

## proof

`npm run verify` plays the real engine from a new game with the starting band and default plans,
across 2000 seeds. it hires nobody and buys nothing; captains who wake up still join, as they do for
any player. one bot walks to the nearest dark lantern and must win without ever needing the free win
from a band too sleepy to fight. it may still lose a battle and try again against a bruised, sleepier
band, and the verifier prints how often. a second bot picks random legal moves and must still win.

## not proven here

fun, reading level and difficulty for the real player need a real playtest. install and update
behavior need a real device.
