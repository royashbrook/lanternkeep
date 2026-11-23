<script lang="ts">
  import { onDestroy, onMount, untrack } from "svelte";
  import { MAX_ROUNDS, colOf, rowOf } from "../engine/battle.ts";
  import type { BattleEvent, BattleLog, Fielder, Pack } from "../engine/types.ts";
  import type { Sound } from "../lib/sound.ts";
  import { view } from "../lib/view.svelte.ts";
  import Badge from "./Badge.svelte";
  import Figure from "./Figure.svelte";
  import Scenery from "./Scenery.svelte";
  import { cap } from "./words.ts";

  let { pack, log, where, bandName, foeName, reward, sound, held, onDone, onMenu }: {
    pack: Pack; log: BattleLog; where: string; bandName: string; foeName: string;
    reward: { xp: number; coins: number }; sound: Sound;
    /** a menu is open over the battle, so it holds still */
    held: boolean;
    onDone: () => void; onMenu: () => void;
  } = $props();

  interface Float { id: number; to: number; text: string; kind: string }
  const units = untrack(() => log.units);
  const events = untrack(() => log.events);
  let hp = $state(units.map((u) => u.hp));
  let down = $state(units.map(() => false));
  let hushed = $state(units.map(() => false));
  let cheered = $state(units.map(() => 0));
  let actor = $state(-1);
  let struck = $state(-1);
  let round = $state(1);
  let caption = $state("The gloom is here!");
  /** the card your fighter just chose, so a plan you set can be seen working */
  let cue = $state("");
  let floats = $state<Float[]>([]);
  let speed = $state(1);
  let paused = $state(false);
  let finished = $state(false);

  let cursor = 0, stopped = false, skipping = false, floatId = 0;

  // slow enough at 1x for a young reader to see who did what; 2x and 4x are one tap away
  const WAIT: Record<BattleEvent["t"], number> = { round: 640, think: 280, hit: 780, heal: 700, cheer: 720, hush: 640, snooze: 560, down: 460, sleepy: 1400, end: 460 };
  const label = (i: number) => (units[i].side === "band" ? units[i].name : `the ${units[i].name}`);

  function float(to: number, text: string, kind: string) {
    const id = ++floatId;
    floats = [...floats, { id, to, text, kind }];
    setTimeout(() => (floats = floats.filter((f) => f.id !== id)), 1000);
  }

  function apply(e: BattleEvent) {
    const loud = !skipping;
    switch (e.t) {
      case "round":
        round = e.n;
        actor = -1;
        struck = -1;
        break;
      case "think": {
        actor = e.by;
        struck = -1;
        const words = e.card ? pack.cards[e.card]?.words : null;
        cue = units[e.by].side === "band" && words ? `${units[e.by].name}'s plan: ${words}` : "";
        break;
      }
      case "hit":
        hp[e.to] = e.hp;
        struck = e.to;
        caption = e.guarded ? `${label(e.to)} jumps in to guard!` : e.strong ? `${label(e.by)} lands a big hit on ${label(e.to)}!` : `${label(e.by)} bonks ${label(e.to)}.`;
        if (loud) {
          float(e.to, e.strong ? `${e.n}!` : `${e.n}`, e.strong ? "big" : e.guarded ? "guarded" : "plain");
          sound.play(e.guarded ? "guard" : e.strong ? "big" : "hit");
        }
        break;
      case "heal":
        hp[e.to] = e.hp;
        caption = `${label(e.by)} helps ${label(e.to)} feel better.`;
        if (loud) {
          float(e.to, `+${e.n}`, "heal");
          sound.play("heal");
        }
        break;
      case "cheer":
        for (const i of e.to) cheered[i] += 1;
        caption = `${label(e.by)} sings. Everyone feels strong!`;
        if (loud) {
          for (const i of e.to) float(i, "♪", "song");
          sound.play("sing");
        }
        break;
      case "hush":
        hushed[e.to] = true;
        caption = `${label(e.by)} sings ${label(e.to)} to sleep.`;
        if (loud) {
          float(e.to, "zzz", "song");
          sound.play("hush");
        }
        break;
      case "snooze":
        hushed[e.who] = false;
        actor = e.who;
        caption = `${label(e.who)} is snoozing.`;
        break;
      case "down":
        hushed[e.who] = false;
        down[e.who] = true;
        if (struck === e.who) struck = -1;
        caption = units[e.who].side === "gloom" ? `${label(e.who)} goes poof!` : `${label(e.who)} is dizzy and sits down.`;
        if (loud) sound.play(units[e.who].side === "gloom" ? "poof" : "dizzy");
        break;
      case "sleepy":
        caption = "Everyone is getting so sleepy...";
        if (loud) sound.play("hush");
        break;
      case "end":
        actor = -1;
        struck = -1;
        break;
    }
  }

  /** waits in game time: a pause or a hidden page holds the battle still */
  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      let left = ms, last = performance.now();
      const tick = () => {
        if (stopped || skipping) return resolve();
        const now = performance.now();
        if (!paused && !held && !document.hidden) left -= (now - last) * speed;
        last = now;
        if (left <= 0) resolve();
        else setTimeout(tick, Math.min(40, left));
      };
      tick();
    });

  // what flies across the middle. fighters who walk up and bonk throw nothing
  const SHOTS: Record<string, string> = { archer: "arrow", mage: "orb", scout: "dart", flyer: "feather", bard: "note" };
  let arena = $state<HTMLElement>();

  function shoot(by: number, to: number, kind: string) {
    if (view.reduced || !arena) return;
    const a = arena.querySelector(`[data-unit="${by}"] .figwrap`)?.getBoundingClientRect();
    const b = arena.querySelector(`[data-unit="${to}"] .figwrap`)?.getBoundingClientRect();
    const box = arena.getBoundingClientRect();
    if (!a || !b) return;
    const x = a.left + a.width / 2 - box.left, y = a.top + a.height * 0.45 - box.top;
    const dx = b.left + b.width / 2 - box.left - x, dy = b.top + b.height * 0.45 - box.top - y;
    const turn = (Math.atan2(dy, dx) * 180) / Math.PI;
    const el = document.createElement("span");
    el.className = `shot ${kind}`;
    el.setAttribute("aria-hidden", "true");
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    arena.appendChild(el);
    const flight = el.animate(
      [{ transform: `translate(-50%, -50%) rotate(${turn}deg)` }, { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${turn}deg)` }],
      { duration: 210 / speed, easing: "ease-in" },
    );
    const gone = () => el.remove();
    flight.onfinish = gone;
    flight.oncancel = gone;
  }

  async function run() {
    await wait(500);
    while (cursor < events.length && !stopped) {
      const e = events[cursor++];
      if (e.t === "hit" && !skipping && !e.splash) {
        const kind = SHOTS[units[e.by].cls];
        if (kind && !view.reduced) {
          shoot(e.by, e.to, kind);
          await wait(200);
          if (stopped) return;
        }
      }
      apply(e);
      if (!skipping) await wait(WAIT[e.t]);
    }
    if (stopped) return;
    finished = true;
    sound.play(log.win ? "win" : "nap");
  }

  function skip() {
    skipping = true;
    paused = false;
    floats = [];
  }

  onMount(() => {
    sound.setMood("battle");
    void run();
  });
  // the pending wait sees this on its next tick and lets the loop finish
  onDestroy(() => {
    stopped = true;
  });

  /** where a fighter stands: the two front rows always face each other across the middle */
  function area(u: Fielder) {
    const r = rowOf(u.slot), c = colOf(u.slot);
    if (view.landscape) return { column: u.side === "band" ? 2 - r : r + 1, row: c + 1 };
    return { column: c + 1, row: u.side === "band" ? r + 1 : 2 - r };
  }
  const bandUnits = units.map((u, i) => ({ u, i })).filter((x) => x.u.side === "band");
  const gloomUnits = units.map((u, i) => ({ u, i })).filter((x) => x.u.side === "gloom");
  const speeds = [1, 2, 4];
  const rowName = (slot: number) => (rowOf(slot) === 0 ? "front row" : "back row");
</script>

{#snippet unit(u: Fielder, i: number)}
  {@const a = area(u)}
  <div
    class="unit"
    class:acting={actor === i}
    class:struck={struck === i}
    class:down={down[i]}
    class:hushed={hushed[i]}
    class:cheered={cheered[i] > 0 && !down[i]}
    class:foe={u.side === "gloom"}
    style:grid-column={a.column}
    style:grid-row={a.row}
    role="img"
    aria-label={`${u.side === "band" ? u.name + " the " + u.cls : u.name}, ${rowName(u.slot)}, ${down[i] ? (u.side === "band" ? "dizzy" : "gone") : `${hp[i]} of ${u.max} health`}`}
    data-unit={i}
  >
    <div class="figwrap">
      <Figure kind={u.foe ?? u.cls} foe={u.side === "gloom"} captain={u.captain} />
      {#if down[i] && u.side === "band"}
        <span class="dizzy" aria-hidden="true"><i></i><i></i><i></i></span>
      {/if}
      {#if down[i] && u.side === "gloom"}
        <span class="sparks" aria-hidden="true">{#each [0, 1, 2, 3, 4, 5] as k (k)}<i style:--k={k}></i>{/each}</span>
      {/if}
      {#if hushed[i]}<span class="snore" aria-hidden="true">z</span>{/if}
      {#if struck === i}<span class="burst" aria-hidden="true"></span>{/if}
      {#each floats.filter((f) => f.to === i) as f (f.id)}
        <span class={`floaty ${f.kind}`} aria-hidden="true">{f.text}</span>
      {/each}
    </div>
    {#if !down[i]}
      <div class="nameplate">
        {#if u.side === "band"}<Badge cls={u.cls} />{/if}
        <span class="bar" class:low={hp[i] / u.max < 0.34}><span class="fill" style:width={`${(hp[i] / u.max) * 100}%`}></span></span>
      </div>
    {/if}
  </div>
{/snippet}

<main class="battle" class:land={view.landscape} data-round={round}>
  <Scenery variant="battle" />
  <header class="battlebar">
    <div class="battletitle">
      <h1>{where}</h1>
      <p role="img" aria-label={`round ${round} of ${MAX_ROUNDS}`}>
        {#each { length: MAX_ROUNDS } as _, n (n)}<i class:on={n < round}></i>{/each}
      </p>
    </div>
    <div class="battlectl" role="group" aria-label="battle controls">
      <button id="pause" aria-pressed={paused} aria-label={paused ? "keep playing" : "pause"} onclick={() => (paused = !paused)} disabled={finished}>
        <svg viewBox="0 0 24 24" aria-hidden="true">{#if paused}<path d="M7 4l13 8-13 8z" />{:else}<path d="M7 4h4v16H7zM14 4h4v16h-4z" />{/if}</svg>
      </button>
      {#each speeds as s (s)}
        <button class="speed" class:sel={speed === s} aria-pressed={speed === s} aria-label={`speed ${s}`} onclick={() => (speed = s)} disabled={finished}>{s}x</button>
      {/each}
      <button id="skip" onclick={skip} disabled={finished}>Skip</button>
      <button id="battle-menu" aria-label="menu and about" onclick={onMenu}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
    </div>
  </header>

  <div class="arena" bind:this={arena}>
    <section class="side theirs" aria-label={foeName}>
      {#each gloomUnits as x (x.i)}{@render unit(x.u, x.i)}{/each}
    </section>
    <div class="middle" aria-hidden="true"></div>
    <section class="side ours" aria-label={bandName}>
      {#each bandUnits as x (x.i)}{@render unit(x.u, x.i)}{/each}
    </section>
  </div>

  <div class="caption">
    <p class="cue" id="plan-cue">{cue}</p>
    <p>{cap(caption)}</p>
  </div>

  {#if finished}
    <div class="result" class:won={log.win} role="status">
      <div class="resultcard">
        <h2>{log.win ? "You won!" : "Your band got dizzy"}</h2>
        <p>
          {#if log.win}The gloomlings poofed into happy sparks.
          {:else}They walk home and feel fine. The gloom is getting sleepier, so try again!{/if}
        </p>
        <p class="spoils">
          <span><svg class="coin" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 6l1.800 3.800 4.200.5-3.100 2.900.8 4.100-3.700-2.100-3.700 2.100.8-4.100L6 10.300l4.200-.5z" /></svg>+{reward.coins} coins</span>
          <span>+{reward.xp} stars each</span>
        </p>
        <button id="battle-ok" class="primary" onclick={onDone}>{log.win ? "Hooray!" : "Okay"}</button>
      </div>
    </div>
  {/if}
</main>
