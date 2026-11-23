<script lang="ts" module>
  // the arrow tip is a brief cue: the first turn arrows appear, then never over the map again
  let arrowsTaught = "";
</script>

<script lang="ts">
  import { untrack } from "svelte";
  import { fightersIn, goalOpen, movesFor, placeOf, YAWN_LIMIT } from "../engine/campaign.ts";
  import type { Band, Game, Pack, PlaceDef } from "../engine/types.ts";
  import type { Sound } from "../lib/sound.ts";
  import { view } from "../lib/view.svelte.ts";
  import Figure from "./Figure.svelte";
  import Flag from "./Flag.svelte";
  import { arrowPath, boardSize, project, riverPath, roadPath, scatter } from "./mapArt.ts";

  let { pack, game, sound, toast, saved, onPlan, onGo, onCamp, onMenu }: {
    pack: Pack; game: Game; sound: Sound; toast: string; saved: boolean;
    onPlan: (band: number, to: string | null) => void; onGo: () => void; onCamp: () => void; onMenu: () => void;
  } = $props();

  // back from a battle or camp, start on a band that can actually walk
  let selected = $state(untrack(() => game.bands.find((b) => b.slots.some((s) => s !== null))?.id ?? 1));
  let info = $state<string | null>(null);

  const land = $derived(view.landscape);
  const size = $derived(boardSize(land));
  const spot = (id: string) => {
    const p = placeOf(pack, id);
    return project(p.x, p.y, land);
  };
  const trees = $derived(scatter(pack, land));
  const river = $derived(riverPath(land));
  const band = $derived(game.bands.find((b) => b.id === selected) ?? game.bands[0]);
  const reach = $derived(new Set(movesFor(pack, game, band.id)));
  const hasFolk = (b: Band) => b.slots.some((s) => s !== null);
  const lead = (b: Band) => fightersIn(game, b)[0];
  const lit = (id: string) => game.lit.includes(id);
  const gloomAt = (id: string) => game.gloom.find((b) => b.at === id);
  const captainOf = (id: string) => !!pack.gloom.find((d) => d.id === id)?.captain;

  const turnKey = $derived(`${game.seed}:${game.turn}`);
  let arrowTurn = $state(arrowsTaught);
  $effect(() => {
    if (arrowsTaught || !game.gloom.some((b) => b.to)) return;
    arrowsTaught = turnKey;
    arrowTurn = turnKey;
  });

  const hint = $derived.by(() => {
    if (!hasFolk(band)) return "This band is empty. Add friends in Camp.";
    if (game.turn === 1) return game.bands.some((b) => b.to) ? "Tap Go when you are ready." : "Tap a glowing town to walk there.";
    if (arrowTurn === turnKey) return "Purple arrows show where the gloom will walk.";
    if (game.turn === 3 && game.coins >= 35) return "You have coins! Open Camp to get new friends.";
    return "";
  });

  function tap(id: string) {
    sound.play("tap");
    info = id;
    if (band.to === id) {
      onPlan(band.id, null);
      return;
    }
    if (reach.has(id)) {
      sound.play("step");
      const current = band.id;
      onPlan(current, id);
      // on to the next band that has not been told where to go
      const next = game.bands.find((b) => b.id !== current && hasFolk(b) && !b.to);
      if (next) selected = next.id;
      return;
    }
    const here = game.bands.filter((b) => b.at === id && hasFolk(b));
    if (here.length) {
      const at = here.findIndex((b) => b.id === band.id);
      selected = here[(at + 1) % here.length].id;
    }
  }

  function describe(p: PlaceDef) {
    const bits = [p.name, lit(p.id) ? "lit" : "dark"];
    const foe = gloomAt(p.id);
    if (foe) bits.push(`gloom band of ${foe.units.length} here`);
    for (const b of game.bands) if (b.at === p.id && hasFolk(b)) bits.push(`${b.name} here`);
    if (p.id === pack.goal && !goalOpen(pack, game)) bits.push("locked until every other lantern is lit");
    if (band.to === p.id) bits.push("your walk is planned here, tap to cancel");
    else if (reach.has(p.id)) bits.push(`tap to walk ${band.name} here`);
    return bits.join(", ");
  }

  const place = $derived(info ? placeOf(pack, info) : null);
  const placeFoe = $derived(info ? gloomAt(info) : undefined);
  const placeKind = (p: PlaceDef) => (p.kind === "keep" ? "the great lantern" : p.kind === "fort" ? "a fort" : "a town");
</script>

<main class="mapscreen">
  <header class="hud">
    <button class="tab menu" aria-label="menu and about" onclick={onMenu}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
    </button>
    <span class="stat" id="coins" aria-label={`${game.coins} coins`}>
      <svg class="coin" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 6l1.800 3.800 4.200.5-3.100 2.900.8 4.100-3.700-2.100-3.700 2.100.8-4.100L6 10.300l4.200-.5z" /></svg>
      <b>{game.coins}</b>
    </span>
    <span class="stat" id="lit" aria-label={`${game.lit.length} of ${pack.places.length} lanterns lit`}>
      <svg class="minilantern" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h8l2 3v9l-2 3H8l-2-3V8z" /><path class="wick" d="M12 9q3 3 1.500 6h-3Q9 12 12 9z" /></svg>
      <b>{game.lit.length}/{pack.places.length}</b>
    </span>
    <span class="stat turn" id="turn">turn <b>{game.turn}</b></span>
  </header>

  <div class="boardwrap">
    <div class="board" class:port={!land}>
      <svg class="art" viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden="true">
        <defs>
          <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#2c4272" />
            <stop offset="1" stop-color="#20305a" />
          </linearGradient>
          <radialGradient id="glow">
            <stop offset="0" stop-color="#ffcf6b" stop-opacity=".78" />
            <stop offset=".5" stop-color="#ffb04a" stop-opacity=".26" />
            <stop offset="1" stop-color="#ffb04a" stop-opacity="0" />
          </radialGradient>
        </defs>
        <rect width={size.w} height={size.h} fill="url(#ground)" />
        <path d={`M0 ${size.h * 0.2}Q${size.w * 0.25} ${size.h * 0.08} ${size.w * 0.5} ${size.h * 0.2}T${size.w} ${size.h * 0.16}V0H0Z`} fill="#3a5487" />
        <path d={`M0 ${size.h * 0.74}Q${size.w * 0.3} ${size.h * 0.62} ${size.w * 0.62} ${size.h * 0.78}T${size.w} ${size.h * 0.7}V${size.h}H0Z`} fill="#26396a" />
        <path d={`M0 ${size.h * 0.9}Q${size.w * 0.4} ${size.h * 0.8} ${size.w * 0.7} ${size.h * 0.92}T${size.w} ${size.h * 0.88}V${size.h}H0Z`} fill="#1c2b53" />
        <path d={river} fill="none" stroke="#fff6dd" stroke-opacity=".5" stroke-width="30" stroke-linecap="round" />
        <path d={river} fill="none" stroke="#5f8fd0" stroke-width="24" stroke-linecap="round" />
        <path d={river} fill="none" stroke="#9cc4ec" stroke-width="3" stroke-dasharray="26 34" stroke-linecap="round" />

        {#each trees as t, i (i)}
          <g transform={`translate(${t.x} ${t.y}) scale(${t.s})`}>
            <ellipse cx="0" cy="17" rx="16" ry="5" fill="#141d3c" opacity=".35" />
            <rect x="-3" y="4" width="6" height="13" fill="#6b5236" />
            {#if t.kind === 0}
              <path d="M0 -32L18 -6H9L21 10H-21L-9 -6H-18Z" fill="#3f7f76" stroke="#d9efe0" stroke-width="2" stroke-linejoin="round" paint-order="stroke" />
            {:else if t.kind === 1}
              <circle cx="0" cy="-10" r="19" fill="#4b8d68" stroke="#d9efe0" stroke-width="2" paint-order="stroke" />
            {:else}
              <path d="M0 -30Q18 -12 15 4Q0 12 -15 4Q-18 -12 0 -30Z" fill="#356f7f" stroke="#d9efe0" stroke-width="2" paint-order="stroke" />
            {/if}
          </g>
        {/each}

        {#each pack.roads as [a, b] (`${a}-${b}`)}
          {@const r = roadPath(spot(a), spot(b))}
          <path d={r.d} fill="none" stroke="#17213f" stroke-opacity=".5" stroke-width="21" stroke-linecap="round" transform="translate(2 4)" />
          <path d={r.d} fill="none" stroke={lit(a) && lit(b) ? "#f4d596" : "#a3a9c6"} stroke-width="16" stroke-linecap="round" />
          <path d={r.d} fill="none" stroke={lit(a) && lit(b) ? "#c79a55" : "#6f7699"} stroke-width="2.500" stroke-dasharray="11 13" stroke-linecap="round" />
          {#if (a === band.at && reach.has(b)) || (b === band.at && reach.has(a))}
            <path class="reachroad" d={r.d} fill="none" stroke="#ffd25e" stroke-width="7" stroke-linecap="round" stroke-dasharray="3 17" />
          {/if}
        {/each}

        {#each pack.places as p (p.id)}
          {@const s = spot(p.id)}
          <g transform={`translate(${s.x} ${s.y})`}>
            <circle class="townglow" class:on={lit(p.id)} r={p.kind === "keep" ? 150 : 104} fill="url(#glow)" />
            {#if reach.has(p.id)}<circle class="ring" r="60" fill="#ffd25e" fill-opacity=".14" stroke="#ffd25e" stroke-width="5" stroke-dasharray="12 9" />{/if}
            <ellipse cx="0" cy="30" rx={p.kind === "keep" ? 66 : 54} ry="16" fill="#131b39" opacity=".42" />
            <g stroke="#fff6dd" stroke-width="3" stroke-linejoin="round" paint-order="stroke">
              {#if p.kind === "town"}
                <path d="M-46 28V2l14-14 14 14v26z" fill={lit(p.id) ? "#e8a06a" : "#5f6c94"} />
                <path d="M-51 3l19-19 19 19z" fill={lit(p.id) ? "#c8505a" : "#454f78"} />
                <rect x="-37" y="9" width="9" height="10" fill={lit(p.id) ? "#ffe07a" : "#2b3560"} stroke="none" />
                <path d="M16 28V6l14-12 14 12v22z" fill={lit(p.id) ? "#f0c07e" : "#67749c"} />
                <path d="M11 7l19-17 19 17z" fill={lit(p.id) ? "#b85a78" : "#49547e"} />
                <rect x="25" y="12" width="9" height="9" fill={lit(p.id) ? "#ffe07a" : "#2b3560"} stroke="none" />
                <path d="M-16 30V-6l16-15 16 15v36z" fill={lit(p.id) ? "#f7d59a" : "#74819f"} />
                <path d="M-22 -4l22-21 22 21z" fill={lit(p.id) ? "#dc6b4f" : "#505b86"} />
                <rect x="-6" y="10" width="12" height="20" rx="6" fill={lit(p.id) ? "#7f4a2c" : "#2f3963"} stroke="none" />
                <circle cx="0" cy="-2" r="4.500" fill={lit(p.id) ? "#ffe07a" : "#2b3560"} stroke="none" />
              {:else if p.kind === "fort"}
                <path d="M-48 30V-18h9v7h9v-7h9v7h9v-7h9V30z" fill={lit(p.id) ? "#c9b08f" : "#616c91"} />
                <path d="M4 30V-8h9v7h8v-7h9v7h8v-7h9V30z" fill={lit(p.id) ? "#b89c7c" : "#566186"} />
                <path d="M-14 30V-32h8v7h7v-7h8v7h7v-7h8V30z" fill={lit(p.id) ? "#dcc6a3" : "#737fa2"} />
                <path d="M-6 30V12a7 7 0 0 1 14 0v18z" fill={lit(p.id) ? "#6d4428" : "#2c365f"} stroke="none" />
                <rect x="-3" y="-16" width="8" height="12" rx="4" fill={lit(p.id) ? "#ffe07a" : "#2b3560"} stroke="none" />
                <path d="M1 -32V-54" stroke="#fff6dd" stroke-width="3" fill="none" />
                <path d="M2 -54l18 6-18 6z" fill={lit(p.id) ? "#ffb83d" : "#6c5a9c"} stroke-width="2" />
              {:else}
                <path d="M-62 34V-6h10v8h10v-8h10v8h10V34z" fill={lit(p.id) ? "#c9b08f" : "#5a648b"} />
                <path d="M22 34V-6h10v8h10v-8h10v8h10V34z" fill={lit(p.id) ? "#c9b08f" : "#5a648b"} />
                <path d="M-26 34V-44h9v8h9v-8h16v8h9v-8h9V34z" fill={lit(p.id) ? "#e3cfaf" : "#6f7a9f"} />
                <path d="M-9 34V14a9 9 0 0 1 18 0v20z" fill={lit(p.id) ? "#6d4428" : "#262f58"} stroke="none" />
                <path d="M-14 -44h28l5 -9h-38z" fill="#3b3560" />
                <rect x="-11" y="-74" width="22" height="22" rx="3" fill={lit(p.id) ? "#ffd65e" : "#3e4a78"} />
                <path d="M-15 -74h30l-5 -10h-20z" fill="#3b3560" />
                {#if lit(p.id)}<path class="flame" d="M0 -71q7 8 3 14h-6q-4 -6 3 -14z" fill="#ff8a3d" stroke="none" />{/if}
              {/if}
            </g>
            <g class="fogpatch" class:gone={lit(p.id)}>
              <ellipse cx="-34" cy="6" rx="40" ry="18" fill="#a9b8dc" opacity=".62" />
              <ellipse cx="26" cy="-6" rx="46" ry="20" fill="#bcc8e6" opacity=".55" />
              <ellipse cx="4" cy="24" rx="52" ry="15" fill="#d5ddf0" opacity=".48" />
            </g>
          </g>
        {/each}

        {#each game.gloom as g (g.id)}
          {#if g.to}
            {@const a = arrowPath(spot(g.at), spot(g.to))}
            <g class="gloomarrow">
              <path d={a.d} fill="none" stroke="#fff6dd" stroke-width="10" stroke-linecap="round" stroke-dasharray="4 16" />
              <path d={a.d} fill="none" stroke="#7b4fc4" stroke-width="6.500" stroke-linecap="round" stroke-dasharray="4 16" />
              <path d="M-16 -14L14 0L-16 14Z" transform={`translate(${a.end.x} ${a.end.y}) rotate(${a.angle})`} fill="#7b4fc4" stroke="#fff6dd" stroke-width="3.500" stroke-linejoin="round" paint-order="stroke" />
            </g>
          {/if}
        {/each}
        {#each game.bands as b (b.id)}
          {#if b.to}
            {@const a = arrowPath(spot(b.at), spot(b.to))}
            <path d={a.d} fill="none" stroke="#fff6dd" stroke-width="13" stroke-linecap="round" />
            <path d={a.d} fill="none" stroke="#ff9d2e" stroke-width="8" stroke-linecap="round" />
            <path d="M-18 -17L18 0L-18 17Z" transform={`translate(${a.end.x} ${a.end.y}) rotate(${a.angle})`} fill="#ff9d2e" stroke="#fff6dd" stroke-width="4" stroke-linejoin="round" paint-order="stroke" />
          {/if}
        {/each}
      </svg>

      {#each pack.places as p (p.id)}
        {@const s = spot(p.id)}
        {@const foe = gloomAt(p.id)}
        {@const here = game.bands.filter((b) => b.at === p.id && hasFolk(b))}
        <button
          class="pin"
          class:can={reach.has(p.id)}
          class:planned={band.to === p.id}
          class:lit={lit(p.id)}
          data-place={p.id}
          data-state={lit(p.id) ? "lit" : "dark"}
          style:left={`${(s.x / size.w) * 100}%`}
          style:top={`${(s.y / size.h) * 100}%`}
          aria-label={describe(p)}
          onclick={() => tap(p.id)}
        >
          <span class="tokens">
            {#if foe}
              <span class="token gloom" data-gloom={foe.id}>
                <Figure kind={foe.units[0].foe} foe captain={captainOf(foe.id)} />
                {#if foe.units.length > 1}<small>{foe.units.length}</small>{/if}
                {#if foe.yawns > 0}<span class="zz" aria-hidden="true">{"z".repeat(foe.yawns)}</span>{/if}
              </span>
            {/if}
            {#each here as b (b.id)}
              <span class="token mine" class:sel={b.id === band.id} data-band={b.id}>
                <Figure kind={lead(b)?.cls ?? "knight"} captain={lead(b)?.captain} />
                <i><Flag band={b.id} /></i>
              </span>
            {/each}
          </span>
          <span class="name">
            {#if p.id === pack.goal && !goalOpen(pack, game)}<svg class="lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>{/if}
            {p.name}
          </span>
        </button>
      {/each}
      {#if hint}<p class="hint" role="status">{hint}</p>{/if}
      {#if toast}<p class="toast" role="status">{toast}</p>{/if}
    </div>
  </div>

  <footer class="tray">
    <div class="infoline">
      {#if !saved}
        <p class="warn">This browser is not saving your game.</p>
      {:else if place}
        <p class="placeinfo">
          {#if place.id === pack.goal && !goalOpen(pack, game)}
            <b>{place.name}</b> is locked. Light every other lantern to open it.
          {:else}
            <b>{place.name}</b> is {placeKind(place)}{lit(place.id) ? " and it is lit." : " in the dark."}
          {/if}
          {#if placeFoe}
            <span class="foes">
              {#each placeFoe.units as u, i (i)}<span class="mini"><Figure kind={u.foe} foe /></span>{/each}
              {#if placeFoe.yawns > 0}
                <span class="sleepy">sleepy {placeFoe.yawns}/{YAWN_LIMIT}</span>
              {/if}
            </span>
          {/if}
        </p>
      {:else}
        <p class="placeinfo">Tap a place to look at it.</p>
      {/if}
    </div>
    <div class="peek" aria-hidden="true">
      <p class="peekname"><Flag band={band.id} />{band.name}</p>
      <div class="peekcells">
        {#each band.slots as id, slot (slot)}
          {@const f = game.fighters.find((x) => x.id === id)}
          <span class="peekcell" class:backrow={slot > 2}>{#if f}<Figure kind={f.cls} captain={f.captain} />{/if}</span>
        {/each}
      </div>
    </div>
    <div class="bands" role="group" aria-label="your bands">
      {#each game.bands as b (b.id)}
        <button class="chip" class:sel={b.id === band.id} class:empty={!hasFolk(b)} aria-pressed={b.id === band.id} aria-label={`${b.name}${b.to ? `, walking to ${placeOf(pack, b.to).name}` : ""}`} data-chip={b.id} onclick={() => { sound.play("tap"); selected = b.id; info = b.at; }}>
          <Flag band={b.id} />
          <span class="chipname">{b.name.replace("Band of the ", "")}</span>
          <span class="chipto">{b.to ? placeOf(pack, b.to).name : hasFolk(b) ? "stay" : "empty"}</span>
        </button>
      {/each}
    </div>
    <div class="actions">
      <button id="camp" class="secondary" onclick={onCamp}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3L2 21h20zM12 11l-4 10M12 11l4 10" /></svg>
        Camp
      </button>
      <button id="go" class="primary" aria-label="go, end this turn" onclick={onGo}>
        Go
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M12 6l6 6-6 6" /></svg>
      </button>
    </div>
  </footer>
</main>
