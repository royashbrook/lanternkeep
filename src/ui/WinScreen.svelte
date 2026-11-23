<script lang="ts">
  import { fightersIn } from "../engine/campaign.ts";
  import type { Game, Pack } from "../engine/types.ts";
  import Figure from "./Figure.svelte";
  import Lantern from "./Lantern.svelte";

  let { pack, game, onAgain, onMenu }: { pack: Pack; game: Game; onAgain: () => void; onMenu: () => void } = $props();
  const parade = $derived([...game.bands.flatMap((b) => fightersIn(game, b)), ...game.fighters.filter((f) => !game.bands.some((b) => b.slots.includes(f.id)))].slice(0, 9));
</script>

<main class="win">
  <div class="winrays" aria-hidden="true">{#each { length: 16 } as _, i (i)}<i style:--r={i}></i>{/each}</div>
  <div class="winlanterns" aria-hidden="true">
    {#each pack.places.slice(0, 7) as p, i (p.id)}<span style:--l={i}><Lantern lit /></span>{/each}
  </div>
  <div class="wintext">
    <h1>{pack.title} is bright again!</h1>
    <p>The gloom had a big yawn and floated away. Every lantern is shining because of you.</p>
    <dl class="winstats">
      <div><dt>Turns</dt><dd>{game.turn}</dd></div>
      <div><dt>Battles won</dt><dd>{game.stats.wins}</dd></div>
      <div><dt>Gloomlings poofed</dt><dd>{game.stats.poofs}</dd></div>
      <div><dt>Friends</dt><dd>{game.fighters.length}</dd></div>
    </dl>
    <div class="winbtns">
      <button id="again" class="primary" onclick={onAgain}>Play again</button>
      <button class="secondary" aria-label="menu and about" onclick={onMenu}>Menu</button>
    </div>
  </div>
  <div class="parade" aria-hidden="true">
    {#each parade as f, i (f.id)}<span style:--p={i}><Figure kind={f.cls} captain={f.captain} /></span>{/each}
  </div>
</main>
