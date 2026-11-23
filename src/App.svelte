<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { emberdale as pack } from "./content/emberdale.ts";
  import { clearNews, currentBattle, endTurn, finishBattle, newGame, placeOf, planMove, rewardFor } from "./engine/campaign.ts";
  import { fromCode, toCode } from "./engine/save.ts";
  import type { Game, News } from "./engine/types.ts";
  import { installControl } from "./install.ts";
  import { createSaver, SAVE_KEY } from "./lib/saves.ts";
  import { createSound } from "./lib/sound.ts";
  import { readJson, writeJson } from "./lib/storage.ts";
  import { watchView } from "./lib/view.svelte.ts";
  import { updateControl, type UpdateCheck } from "./pwa.ts";
  import BattleScreen from "./ui/BattleScreen.svelte";
  import CampScreen from "./ui/CampScreen.svelte";
  import Figure from "./ui/Figure.svelte";
  import Lantern from "./ui/Lantern.svelte";
  import MapScreen from "./ui/MapScreen.svelte";
  import Moment, { type MomentData } from "./ui/Moment.svelte";
  import Scenery from "./ui/Scenery.svelte";
  import Sheet from "./ui/Sheet.svelte";
  import WinScreen from "./ui/WinScreen.svelte";

  const ETHOS = "no ads, no lives, no timers, nothing to buy, no accounts, no cookies, nothing sold or shared.";
  const SETTINGS = "lanternkeep:settings";

  const saver = createSaver(pack);
  const loaded = saver.load();
  const prefs = readJson(SETTINGS, { music: true, sfx: true });
  const sound = createSound({ music: prefs.music !== false, sfx: prefs.sfx !== false });

  let game = $state.raw<Game | null>(loaded.game);
  let scene = $state<"title" | "play" | "camp">("title");
  let sheet = $state<"" | "about" | "howto" | "code" | "confirm-new" | "confirm-load" | "ios" | "elsewhere">("");
  let saved = $state(!loaded.blocked);
  let unreadable = $state(loaded.unreadable);
  let moments = $state.raw<MomentData[]>([]);
  let toast = $state("");
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  let music = $state(prefs.music !== false);
  let sfx = $state(prefs.sfx !== false);
  let codeIn = $state("");
  let codeNote = $state("");
  let pending = $state.raw<Game | null>(null);

  const seed = () => crypto.getRandomValues(new Uint32Array(1))[0];
  const battle = $derived(game && game.phase === "battle" ? currentBattle(pack, game) : null);
  const moment = $derived(moments[0]);
  const showBattle = $derived(scene !== "title" && !moment && !!battle && !!game);
  const showWin = $derived(scene !== "title" && !moment && game?.phase === "won");
  const code = $derived(sheet === "code" && game ? toCode(game) : "");

  function toMoments(news: News[]): MomentData[] {
    const out: MomentData[] = [];
    const levels = new Map<number, number>();
    for (const n of news) {
      if (n.k === "lit") out.push({ k: "lit", place: n.place, coins: n.coins });
      else if (n.k === "joined") out.push({ k: "joined", fighter: n.fighter });
      else if (n.k === "bands") out.push({ k: "bands", count: n.count });
      else if (n.k === "size") out.push({ k: "size", count: n.count });
      else if (n.k === "level") levels.set(n.fighter, n.level);
    }
    if (levels.size) out.push({ k: "levels", list: [...levels].map(([id, level]) => ({ id, level })) });
    return out;
  }

  function showToast(text: string) {
    toast = text;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast = ""), 4200);
  }

  function commit(next: Game) {
    if (next === game && next.news.length === 0) return;
    if (next.news.length) {
      moments = [...moments, ...toMoments(next.news)];
      const home = next.news.find((n) => n.k === "home");
      if (home && home.k === "home") {
        const b = next.bands.find((x) => x.id === home.band);
        if (b) showToast(`${b.name} walked home to ${placeOf(pack, home.place).name}.`);
      }
    }
    const clean = clearNews(next);
    game = clean;
    saved = saver.save(clean);
    if (saved) unreadable = false;
  }

  function play() {
    sound.play("tap");
    if (!game) commit(newGame(pack, seed()));
    scene = "play";
    sound.setMood("map");
  }
  function startOver() {
    sheet = "";
    moments = [];
    commit(newGame(pack, seed()));
    scene = "play";
    sound.setMood("map");
  }
  function go() {
    if (!game) return;
    sound.play("step");
    commit(endTurn(pack, game));
  }
  function battleDone() {
    if (!game) return;
    commit(finishBattle(pack, game));
    sound.setMood("map");
  }
  function nextMoment() {
    sound.play("tap");
    moments = moments.slice(1);
  }

  function setSound(next: { music: boolean; sfx: boolean }) {
    music = next.music;
    sfx = next.sfx;
    writeJson(SETTINGS, next);
    sound.set(next);
  }

  async function copy(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      codeNote = done;
    } catch {
      codeNote = "Copy did not work here. Press and hold the code to copy it.";
    }
  }
  function tryCode() {
    const g = fromCode(pack, codeIn);
    if (!g) {
      codeNote = "That code did not work. Check that you pasted all of it.";
      return;
    }
    pending = g;
    sheet = "confirm-load";
  }
  function loadPending() {
    if (!pending) return;
    moments = [];
    commit(pending);
    pending = null;
    codeIn = "";
    codeNote = "";
    sheet = "";
    scene = "play";
    sound.setMood("map");
  }

  let installVisible = $state(false);
  let updateReady = $state(false);
  let updateNote = $state("");
  let install: ReturnType<typeof installControl>;
  let updates: ReturnType<typeof updateControl>;
  async function checkUpdate() {
    updateNote = "Checking...";
    const result: UpdateCheck = await updates.check();
    updateNote = result === "current" ? "You have the newest version." : result === "newer" ? "A new version is ready." : "Could not check right now.";
  }
  async function applyUpdate() {
    try {
      if (game) saver.save(game);
      await updates.apply();
    } catch {
      updateNote = "The update did not finish. Try again in a moment.";
    }
  }

  const WAKES = ["pointerup", "touchend", "click", "keydown"];
  const wake = () => sound.wake();
  const visibility = () => sound.setHidden(document.hidden);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== SAVE_KEY) return;
    saver.stop();
    sheet = "elsewhere";
  };
  let stopView: (() => void) | undefined;
  onMount(() => {
    stopView = watchView();
    install = installControl((v) => (installVisible = v), () => (sheet = "ios"));
    updates = updateControl(() => (updateReady = true));
    for (const type of WAKES) addEventListener(type, wake, { capture: true, passive: true });
    document.addEventListener("visibilitychange", visibility);
    addEventListener("storage", onStorage);
    (window as unknown as { __lanternkeep: unknown }).__lanternkeep = { state: () => game };
  });
  onDestroy(() => {
    stopView?.();
    install?.dispose();
    updates?.dispose();
    sound.dispose();
    if (toastTimer) clearTimeout(toastTimer);
    if (typeof removeEventListener === "function") {
      for (const type of WAKES) removeEventListener(type, wake, { capture: true });
      document.removeEventListener("visibilitychange", visibility);
      removeEventListener("storage", onStorage);
    }
  });
</script>

<span id="version">v{__APP_VERSION__}</span>

{#if scene === "title" || !game}
  <main class="title">
    <Scenery variant="title" />
    <div class="titlelantern"><Lantern lit big /></div>
    <h1 class="wordmark">Lantern Keep</h1>
    <p class="tagline">The gloom blew out the lanterns. Go light them again!</p>
    <div class="titlecast" aria-hidden="true">
      <span><Figure kind="rider" /></span><span><Figure kind="knight" /></span><span><Figure kind="mage" /></span><span class="gl"><Figure kind="puff" foe /></span>
    </div>
    {#if unreadable}
      <p class="note" role="status">We could not read the old save, so it is kept safe. A new game will not erase it.</p>
    {/if}
    {#if !saved}<p class="note" role="status">This browser is not saving, but you can still play.</p>{/if}
    <div class="titlebtns">
      <button id="play" class="primary huge" onclick={play}>{game ? "Keep playing" : "Play"}</button>
      <div class="titlerow">
        <button id="howto" class="secondary" onclick={() => (sheet = "howto")}>How to play</button>
        <button id="about" class="secondary" onclick={() => (sheet = "about")}>About</button>
      </div>
    </div>
  </main>
{:else if showBattle && battle && game}
  {#key game.fights}
    <BattleScreen
      {pack}
      log={battle}
      where={placeOf(pack, game.bands.find((b) => b.id === game?.queue[0].band)!.at).name}
      bandName={game.bands.find((b) => b.id === game?.queue[0].band)!.name}
      foeName={pack.gloom.find((d) => d.id === game?.queue[0].gloom)!.name}
      reward={rewardFor(pack, game, battle)}
      {sound}
      held={sheet !== ""}
      onDone={battleDone}
      onMenu={() => (sheet = "about")}
    />
  {/key}
{:else if showWin && game}
  <WinScreen {pack} {game} onAgain={() => (sheet = "confirm-new")} onMenu={() => (sheet = "about")} />
{:else if scene === "camp"}
  <CampScreen {pack} {game} {sound} onChange={commit} onBack={() => { sound.play("tap"); scene = "play"; }} />
{:else}
  <MapScreen
    {pack}
    {game}
    {sound}
    {toast}
    {saved}
    onPlan={(band, to) => game && commit(planMove(pack, game, band, to))}
    onGo={go}
    onCamp={() => { sound.play("tap"); scene = "camp"; }}
    onMenu={() => (sheet = "about")}
  />
{/if}

{#if moment && game && scene !== "title"}
  {#key moments}
    <Moment {pack} {game} {moment} {sound} onNext={nextMoment} />
  {/key}
{/if}

{#if updateReady}<button class="update" onclick={applyUpdate}>New version, tap to load</button>{/if}

{#if sheet === "about"}
  <Sheet label="about" onClose={() => (sheet = "")}>
    <h2 class="sheet-title">Lantern Keep</h2>
    <p>A little paper band walks from town to town and lights the lanterns the gloom blew out. You set them up, then watch them go.</p>
    <div class="sheetbtns">
      <button id="music" class="secondary" role="switch" aria-checked={music} onclick={() => setSound({ music: !music, sfx })}>Music: {music ? "on" : "off"}</button>
      <button id="sounds" class="secondary" role="switch" aria-checked={sfx} onclick={() => setSound({ music, sfx: !sfx })}>Sounds: {sfx ? "on" : "off"}</button>
    </div>
    <div class="sheetbtns">
      <button class="secondary" onclick={() => (sheet = "howto")}>How to play</button>
      {#if game}<button id="open-code" class="secondary" onclick={() => { codeNote = ""; sheet = "code"; }}>Save code</button>{/if}
      {#if !game}<button id="open-code" class="secondary" onclick={() => { codeNote = ""; sheet = "code"; }}>Load a save code</button>{/if}
    </div>
    <div class="sheetbtns">
      {#if scene !== "title"}<button id="to-title" class="secondary" onclick={() => { sheet = ""; scene = "title"; sound.setMood("none"); }}>Title screen</button>{/if}
      {#if game}<button id="restart" class="secondary" onclick={() => (sheet = "confirm-new")}>Start over</button>{/if}
    </div>
    <p class="version">version {__APP_VERSION__}, build {__BUILD_ID__}</p>
    <div class="sheetbtns">
      <button class="secondary" onclick={checkUpdate}>Check for update</button>
      {#if installVisible}<button id="install" class="secondary" onclick={() => install.prompt()}>Install</button>{/if}
    </div>
    {#if updateNote}<p role="status">{updateNote}</p>{/if}
    <p><a class="licences" href="/licenses.md" target="_blank" rel="noopener">licences</a></p>
    <p class="ethos">{ETHOS}</p>
    <p class="maker">made with <svg aria-hidden="true" class="mark-heart" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg><span class="sr">love</span> by
      <a href="https://royashbrook.com" target="_blank" rel="noopener">roy</a> +
      <a href="https://royashbrook.com/agents" target="_blank" rel="noopener">ai</a>
      <span class="mark-tail"><span aria-hidden="true" class="mark-dot">·</span>
      <a href="https://github.com/sponsors/royashbrook" target="_blank" rel="noopener">sponsor me</a></span></p>
    <button id="close" class="primary" onclick={() => (sheet = "")}>Back</button>
  </Sheet>
{:else if sheet === "howto"}
  <Sheet label="how to play" onClose={() => (sheet = "")}>
    <h2 class="sheet-title">How to play</h2>
    <ol class="howto">
      <li><span class="howfig"><Figure kind="knight" /></span><div><b>Walk.</b> Tap a glowing town. Then tap Go. Each band walks one road.</div></li>
      <li><span class="howfig"><Lantern lit /></span><div><b>Light it up.</b> Stop on a dark town to light its lantern. Towns give you coins.</div></li>
      <li><span class="howfig"><Figure kind="puff" foe /></span><div><b>Watch out.</b> Purple arrows show where the gloom will walk. If you meet, your band fights by itself.</div></li>
      <li><span class="howfig"><Figure kind="healer" /></span><div><b>Nobody gets hurt.</b> A beaten fighter just gets dizzy and walks home. You can always try again.</div></li>
      <li><span class="howfig"><Figure kind="bard" /></span><div><b>Camp.</b> Move your fighters, hire new friends and buy gear. Knights like the front. Archers and healers like the back.</div></li>
      <li><span class="howfig"><Lantern /></span><div><b>Win.</b> Light every lantern to open the Keep. Then light the great lantern!</div></li>
    </ol>
    <p class="matchups"><b>Who beats who:</b> riders beat archers and mages. Archers beat flyers. Mages beat knights. Knights beat riders. Scouts slip past the front row.</p>
    <button id="close" class="primary" onclick={() => (sheet = "")}>Got it</button>
  </Sheet>
{:else if sheet === "code"}
  <Sheet label="save code" onClose={() => (sheet = "")}>
    <h2 class="sheet-title">Save code</h2>
    {#if game}
      <p>This code is your whole game. Copy it to move your game to another device.</p>
      <textarea id="code-out" readonly rows="4" aria-label="your save code" value={code}></textarea>
      <button id="copy-code" class="secondary" onclick={() => copy(code, "Copied!")}>Copy code</button>
    {/if}
    <h3>Load a code</h3>
    <textarea id="code-in" rows="3" aria-label="paste a save code" placeholder="Paste a save code here" bind:value={codeIn}></textarea>
    <button id="load-code" class="secondary" disabled={!codeIn.trim()} onclick={tryCode}>Load this code</button>
    {#if unreadable && saver.kept()}
      <button id="copy-old" class="secondary" onclick={() => copy(saver.kept() ?? "", "Copied the old save.")}>Copy the old save</button>
    {/if}
    {#if codeNote}<p id="code-note" role="status">{codeNote}</p>{/if}
    <button id="close" class="primary" onclick={() => (sheet = "")}>Back</button>
  </Sheet>
{:else if sheet === "confirm-new"}
  <Sheet label="start over" onClose={() => (sheet = "")}>
    <h2 class="sheet-title">Start a new game?</h2>
    <p>Your band, your coins and your lit lanterns will all go away.</p>
    <button id="confirm-new" class="primary" onclick={startOver}>Start over</button>
    <button id="close" class="secondary" onclick={() => (sheet = "")}>Keep my game</button>
  </Sheet>
{:else if sheet === "confirm-load"}
  <Sheet label="load this game" onClose={() => (sheet = "code")}>
    <h2 class="sheet-title">Load this game?</h2>
    <p>The game from the code will take the place of the one you have now.</p>
    <button id="confirm-load" class="primary" onclick={loadPending}>Load it</button>
    <button id="close" class="secondary" onclick={() => (sheet = "code")}>Keep my game</button>
  </Sheet>
{:else if sheet === "ios"}
  <Sheet label="install" onClose={() => (sheet = "")}>
    <h2 class="sheet-title">Install Lantern Keep</h2>
    <p>In Safari, tap the <b>share</b> button, then <b>Add to Home Screen</b>.</p>
    <button id="close" class="primary" onclick={() => (sheet = "")}>Back</button>
  </Sheet>
{:else if sheet === "elsewhere"}
  <Sheet label="open somewhere else" onClose={() => location.reload()}>
    <h2 class="sheet-title">Your game is open somewhere else</h2>
    <p>This one has stopped saving, so it cannot undo anything.</p>
    <button id="play-here" class="primary" onclick={() => location.reload()}>Play here</button>
  </Sheet>
{/if}
