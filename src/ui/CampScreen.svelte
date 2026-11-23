<script lang="ts">
  import { statsOf } from "../engine/battle.ts";
  import { buyGear, hireCost, MAX_PLAN, maxSize, offers, placeFighter, recruit, resetPlan, setPlan, xpNeeded, MAX_LEVEL } from "../engine/campaign.ts";
  import type { Fighter, Game, Pack } from "../engine/types.ts";
  import type { Sound } from "../lib/sound.ts";
  import Badge from "./Badge.svelte";
  import Figure from "./Figure.svelte";
  import Flag from "./Flag.svelte";
  import Sheet from "./Sheet.svelte";
  import { cap } from "./words.ts";

  let { pack, game, sound, onChange, onBack }: { pack: Pack; game: Game; sound: Sound; onChange: (g: Game) => void; onBack: () => void } = $props();

  let tab = $state<"bands" | "hire" | "gear">("bands");
  let picked = $state<number | null>(null);
  let detail = $state<number | null>(null);
  let gearFor = $state<number | null>(null);
  let drag = $state<{ id: number; x: number; y: number } | null>(null);
  let press: { id: number; x: number; y: number; pointer: number } | null = null;
  let justDragged = false;

  const byId = (id: number | null) => (id === null ? undefined : game.fighters.find((f) => f.id === id));
  const bench = $derived(game.fighters.filter((f) => !game.bands.some((b) => b.slots.includes(f.id))));
  const pickedF = $derived(byId(picked));
  const detailF = $derived(byId(detail));
  const gearF = $derived(byId(gearFor) ?? game.fighters[0]);
  const size = $derived(maxSize(game));

  function change(next: Game) {
    if (next !== game) sound.play("tap");
    onChange(next);
  }

  function tapCell(bandId: number, slot: number, id: number | null) {
    if (justDragged) return;
    if (picked !== null) {
      if (picked === id) {
        picked = null;
        return;
      }
      change(placeFighter(pack, game, picked, bandId, slot));
      picked = null;
      return;
    }
    if (id !== null) {
      sound.play("tap");
      picked = id;
    }
  }

  function tapBench(id: number) {
    if (justDragged) return;
    sound.play("tap");
    picked = picked === id ? null : id;
  }

  function toBench() {
    if (picked === null) return;
    change(placeFighter(pack, game, picked, null, 0));
    picked = null;
  }

  // dragging: the same move as two taps, for fingers that prefer it
  function down(e: PointerEvent, id: number | null) {
    if (id === null || e.button > 0) return;
    press = { id, x: e.clientX, y: e.clientY, pointer: e.pointerId };
    justDragged = false;
  }
  function moved(e: PointerEvent) {
    if (!press || e.pointerId !== press.pointer) return;
    if (!drag && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 10) return;
    drag = { id: press.id, x: e.clientX, y: e.clientY };
  }
  function up(e: PointerEvent) {
    if (!press || e.pointerId !== press.pointer) return;
    const was = drag;
    press = null;
    drag = null;
    if (!was) return;
    justDragged = true;
    setTimeout(() => (justDragged = false), 60);
    picked = null;
    const under = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-cell],[data-bench]");
    if (!under) return;
    if (under.dataset.bench !== undefined) change(placeFighter(pack, game, was.id, null, 0));
    else change(placeFighter(pack, game, was.id, Number(under.dataset.band), Number(under.dataset.slot)));
  }
  function cancel() {
    press = null;
    drag = null;
  }

  // on a small card the crown already says captain, and the title would cut the name off
  const short = (name: string) => name.replace(/^(Captain|The) /, "");
  let hired = $state("");
  function hire(cls: string) {
    const next = recruit(pack, game, cls);
    if (next === game) return;
    sound.play("coin");
    const f = next.fighters[next.fighters.length - 1];
    const seated = next.bands.find((b) => b.slots.includes(f.id));
    hired = seated ? `${f.name} the ${f.cls} joined ${seated.name}!` : `${f.name} the ${f.cls} is waiting in camp. Your bands are full.`;
    onChange(next);
  }

  const cardWords = (id: string) => cap(pack.cards[id]?.words ?? id);
  function move(f: Fighter, i: number, by: number) {
    const plan = [...f.plan];
    const j = i + by;
    if (j < 0 || j >= plan.length) return;
    [plan[i], plan[j]] = [plan[j], plan[i]];
    change(setPlan(pack, game, f.id, plan));
  }
  const drop = (f: Fighter, id: string) => change(setPlan(pack, game, f.id, f.plan.filter((c) => c !== id)));
  const add = (f: Fighter, id: string) => change(setPlan(pack, game, f.id, [...f.plan, id]));
  const statLine = (f: Fighter) => statsOf(pack.classes[f.cls], f.level, f.gear ? pack.gear[f.gear] : null);
  const gearItems = $derived(Object.values(pack.gear));
</script>

<svelte:window onpointermove={moved} onpointerup={up} onpointercancel={cancel} />

{#snippet card(f: Fighter)}
  <span class="figcell"><Figure kind={f.cls} captain={f.captain} /></span>
  <span class="cellname"><Badge cls={f.cls} />{short(f.name)}</span>
  <span class="celllv">lv {f.level}</span>
{/snippet}

<main class="camp">
  <header class="camphead">
    <button id="camp-back" class="tab" onclick={onBack}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H6M12 6l-6 6 6 6" /></svg>
      Map
    </button>
    <h1>Camp</h1>
    <span class="stat" aria-label={`${game.coins} coins`}>
      <svg class="coin" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 6l1.800 3.800 4.200.5-3.100 2.900.8 4.100-3.700-2.100-3.700 2.100.8-4.100L6 10.300l4.200-.5z" /></svg>
      <b id="camp-coins">{game.coins}</b>
    </span>
  </header>

  <div class="tabs" role="tablist" aria-label="camp">
    <button role="tab" id="tab-bands" aria-selected={tab === "bands"} class:sel={tab === "bands"} onclick={() => (tab = "bands")}>Bands</button>
    <button role="tab" id="tab-hire" aria-selected={tab === "hire"} class:sel={tab === "hire"} onclick={() => (tab = "hire")}>New friends</button>
    <button role="tab" id="tab-gear" aria-selected={tab === "gear"} class:sel={tab === "gear"} onclick={() => (tab = "gear")}>Gear</button>
  </div>

  <div class="campbody">
    {#if tab === "bands"}
      <p class="lead">{pickedF ? `Tap a spot to move ${pickedF.name}.` : "Tap a fighter, then tap a spot. Front row fighters get hit first."}</p>
      <div class="bandgrid">
        {#each game.bands as b (b.id)}
          <section class="bandcard" aria-label={b.name}>
            <h2><Flag band={b.id} />{b.name} <small>{b.slots.filter((s) => s !== null).length}/{size}</small></h2>
            <div class="enemyside" aria-hidden="true">the gloom is this way</div>
            <div class="cells">
              {#each b.slots as id, slot (slot)}
                {@const f = byId(id)}
                <button
                  class="cell"
                  class:full={!!f}
                  class:picked={picked !== null && picked === id}
                  class:target={picked !== null && picked !== id}
                  class:backrow={slot > 2}
                  data-cell
                  data-band={b.id}
                  data-slot={slot}
                  aria-label={`${b.name}, ${slot < 3 ? "front" : "back"} row spot ${(slot % 3) + 1}: ${f ? `${f.name} the ${f.cls}` : "empty"}`}
                  onpointerdown={(e) => down(e, id)}
                  onclick={() => tapCell(b.id, slot, id)}
                >
                  {#if f}{@render card(f)}{:else}<span class="rowword">{slot < 3 ? "front" : "back"}</span>{/if}
                </button>
              {/each}
            </div>
          </section>
        {/each}
      </div>
      <section class="benchcard" data-bench aria-label="waiting in camp">
        <h2>Waiting in camp</h2>
        {#if pickedF && game.bands.some((b) => b.slots.includes(pickedF.id))}
          <button id="to-bench" class="secondary" onclick={toBench}>Move {pickedF.name} here</button>
        {/if}
        {#if bench.length}
          <div class="benchlist">
            {#each bench as f (f.id)}
              <button class="cell full" class:picked={picked === f.id} data-benched={f.id} aria-label={`${f.name} the ${f.cls}, waiting in camp`} onpointerdown={(e) => down(e, f.id)} onclick={() => tapBench(f.id)}>
                {@render card(f)}
              </button>
            {/each}
          </div>
        {:else}
          <p class="quiet">Everyone is in a band.</p>
        {/if}
      </section>
      {#if pickedF}
        <div class="pickbar">
          <span class="pickfig"><Figure kind={pickedF.cls} captain={pickedF.captain} /></span>
          <span class="picktext"><b>{pickedF.name}</b> the {pickedF.cls}<br /><small>{cap(pack.classes[pickedF.cls].blurb)}.</small></span>
          <button id="open-plan" class="primary" onclick={() => { detail = pickedF?.id ?? null; picked = null; }}>Plans</button>
        </div>
      {/if}
    {:else if tab === "hire"}
      <p class="lead" role="status">{hired || "Every town you light has someone who wants to help."}</p>
      <div class="hiregrid">
        {#each offers(pack, game) as cls (cls)}
          {@const c = pack.classes[cls]}
          {@const cost = hireCost(pack, game, cls)}
          <article class="hirecard">
            <span class="hirefig"><Figure kind={cls} /></span>
            <h2><Badge cls={cls} />{cap(c.name)}</h2>
            <p>{cap(c.blurb)}.</p>
            <button class="primary" data-hire={cls} disabled={game.coins < cost} aria-label={`hire a ${c.name} for ${cost} coins`} onclick={() => hire(cls)}>
              Hire for {cost}
            </button>
          </article>
        {:else}
          <p class="quiet">Light a town to meet someone new.</p>
        {/each}
      </div>
    {:else}
      <p class="lead">Pick who gets it, then pick the gear. Each fighter carries one thing.</p>
      <div class="whorow" role="group" aria-label="who gets the gear">
        {#each game.fighters as f (f.id)}
          <button class="who" class:sel={gearF?.id === f.id} aria-pressed={gearF?.id === f.id} aria-label={`${f.name} the ${f.cls}`} onclick={() => { sound.play("tap"); gearFor = f.id; }}>
            <span class="whofig"><Figure kind={f.cls} captain={f.captain} /></span>
            <small>{short(f.name)}</small>
          </button>
        {/each}
      </div>
      <div class="geargrid">
        {#each gearItems as g (g.id)}
          <article class="gearcard" class:owned={gearF?.gear === g.id}>
            <h2>{cap(g.name)}</h2>
            <p>{cap(g.blurb)}.</p>
            {#if gearF?.gear === g.id}
              <p class="good">{gearF.name} has this</p>
            {:else}
              <button class="primary" data-gear={g.id} disabled={game.coins < g.cost} aria-label={`buy ${g.name} for ${gearF?.name} for ${g.cost} coins`} onclick={() => { sound.play("coin"); if (gearF) onChange(buyGear(pack, game, g.id, gearF.id)); }}>
                Buy for {g.cost}
              </button>
            {/if}
          </article>
        {/each}
      </div>
    {/if}
  </div>
</main>

{#if drag}
  {@const f = byId(drag.id)}
  {#if f}<div class="ghost" style:left={`${drag.x}px`} style:top={`${drag.y}px`} aria-hidden="true"><Figure kind={f.cls} captain={f.captain} /></div>{/if}
{/if}

{#if detailF}
  {@const c = pack.classes[detailF.cls]}
  {@const s = statLine(detailF)}
  <Sheet label={`${detailF.name}'s plans`} onClose={() => (detail = null)}>
    <div class="planhead">
      <span class="planfig"><Figure kind={detailF.cls} captain={detailF.captain} /></span>
      <div>
        <h2>{detailF.name} the {c.name}</h2>
        <p>{cap(c.blurb)}.</p>
        <p class="statline">Level {detailF.level}, health {s.max}, power {s.power}</p>
        {#if detailF.level < MAX_LEVEL}
          <span class="bar xp" role="img" aria-label={`${detailF.xp} of ${xpNeeded(detailF.level)} stars to the next level`}><span class="fill" style:width={`${(detailF.xp / xpNeeded(detailF.level)) * 100}%`}></span></span>
        {/if}
      </div>
    </div>
    <h3>Plan</h3>
    <p class="quiet">{detailF.name} tries card 1 first. If it does not fit, card 2, then card 3.</p>
    <ol class="plan">
      {#each detailF.plan as id, i (id)}
        <li class="plancard">
          <span class="num" aria-hidden="true">{i + 1}</span>
          <span class="words">{cardWords(id)}</span>
          <button aria-label={`move ${cardWords(id)} up`} disabled={i === 0} onclick={() => detailF && move(detailF, i, -1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg></button>
          <button aria-label={`move ${cardWords(id)} down`} disabled={i === detailF.plan.length - 1} onclick={() => detailF && move(detailF, i, 1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg></button>
          <button aria-label={`take away ${cardWords(id)}`} onclick={() => detailF && drop(detailF, id)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
        </li>
      {:else}
        <li class="quiet">No cards. {detailF.name} will just bonk the closest one.</li>
      {/each}
    </ol>
    {#if detailF.plan.length < MAX_PLAN}
      <h3>Add a card</h3>
      <div class="addcards">
        {#each c.cards.filter((id) => !detailF?.plan.includes(id)) as id (id)}
          <button class="addcard" data-card={id} onclick={() => detailF && add(detailF, id)}>{cardWords(id)}</button>
        {/each}
      </div>
    {/if}
    <div class="sheetbtns">
      <button id="plan-reset" class="secondary" onclick={() => { if (detailF) change(resetPlan(pack, game, detailF.id)); }}>Use the good plan</button>
      <button id="plan-done" class="primary" onclick={() => (detail = null)}>Done</button>
    </div>
  </Sheet>
{/if}
