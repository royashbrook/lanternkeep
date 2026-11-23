<script lang="ts" module>
  export type MomentData =
    | { k: "lit"; place: string; coins: number }
    | { k: "joined"; fighter: number }
    | { k: "levels"; list: { id: number; level: number }[] }
    | { k: "bands"; count: number }
    | { k: "size"; count: number };
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import { placeOf } from "../engine/campaign.ts";
  import type { Game, Pack } from "../engine/types.ts";
  import type { Sound } from "../lib/sound.ts";
  import Figure from "./Figure.svelte";
  import Lantern from "./Lantern.svelte";

  let { pack, game, moment, sound, onNext }: { pack: Pack; game: Game; moment: MomentData; sound: Sound; onNext: () => void } = $props();
  const fighter = (id: number) => game.fighters.find((f) => f.id === id);
  let button = $state<HTMLButtonElement>();
  onMount(() => {
    sound.play(moment.k === "lit" ? "light" : moment.k === "levels" ? "coin" : "join");
    button?.focus({ preventScroll: true });
  });
</script>

<div class="moment" class:litmoment={moment.k === "lit"} role="dialog" aria-modal="true" aria-label="good news" data-moment={moment.k}>
  {#if moment.k === "lit"}
    <div class="rays" aria-hidden="true">{#each { length: 12 } as _, i (i)}<i style:--r={i}></i>{/each}</div>
    <div class="fogdoor left" aria-hidden="true"></div>
    <div class="fogdoor right" aria-hidden="true"></div>
    <div class="embers" aria-hidden="true">{#each { length: 14 } as _, i (i)}<i style:--e={i}></i>{/each}</div>
  {/if}
  <div class="momentbody">
    {#if moment.k === "lit"}
      {@const p = placeOf(pack, moment.place)}
      <div class="bigl"><Lantern lit big /></div>
      <h2>{p.kind === "keep" ? "The great lantern is lit!" : `${p.name} is lit!`}</h2>
      {#if moment.coins > 0}<p>The town says thank you: <b>+{moment.coins} coins</b></p>{/if}
    {:else if moment.k === "joined"}
      {@const f = fighter(moment.fighter)}
      {#if f}
        <div class="bigf"><Figure kind={f.cls} captain /></div>
        <h2>{f.name} woke up!</h2>
        <p>The gloom made them sleepy and grumpy. Now they want to help. A new {f.cls} joins you!</p>
      {/if}
    {:else if moment.k === "levels"}
      <div class="levelrow">
        {#each moment.list.slice(0, 5) as x (x.id)}
          {@const f = fighter(x.id)}
          {#if f}<div class="lv"><Figure kind={f.cls} captain={f.captain} /><b>{f.name}</b><span>level {x.level}</span></div>{/if}
        {/each}
      </div>
      <h2>{moment.list.length === 1 ? "Level up!" : "Level ups!"}</h2>
      <p>Stronger and braver.</p>
    {:else if moment.k === "bands"}
      <div class="bigl"><Lantern lit /></div>
      <h2>A new band!</h2>
      <p>You can have {moment.count} bands now. Open Camp and put friends in it.</p>
    {:else}
      <div class="bigl"><Lantern lit /></div>
      <h2>Bigger bands!</h2>
      <p>Each band can hold {moment.count} fighters now.</p>
    {/if}
    <button bind:this={button} id="moment-ok" class="primary" onclick={onNext}>{moment.k === "lit" ? "Hooray!" : "Nice!"}</button>
  </div>
</div>
