<script lang="ts">
  // every fighter and gloomling is a chunky cut-paper figure on a little stand. the pale rim on
  // every shape is the edge of the paper. each class has its own outline, so nobody relies on colour.
  let { kind, foe = false, captain = false }: { kind: string; foe?: boolean; captain?: boolean } = $props();
  const ink = "#2b2540";
  const rim = "#fff6dd";
  const skin: Record<string, string> = { knight: "#f6cda6", archer: "#c98f62", mage: "#f2c9a0", healer: "#8d5a3c", rider: "#e8b78c", scout: "#a9704a", flyer: "#f6d4b4", bard: "#d6a074" };
</script>

{#snippet face(cx: number, cy: number)}
  <circle cx={cx - 7} {cy} r="2.6" fill={ink} stroke="none" />
  <circle cx={cx + 7} {cy} r="2.6" fill={ink} stroke="none" />
  <circle cx={cx - 11} cy={cy + 6} r="3" fill="#ef8f8f" opacity=".7" stroke="none" />
  <circle cx={cx + 11} cy={cy + 6} r="3" fill="#ef8f8f" opacity=".7" stroke="none" />
  <path d={`M${cx - 4} ${cy + 7}q4 4 8 0`} fill="none" stroke={ink} stroke-width="2" paint-order="normal" />
{/snippet}

{#snippet person(tunic: string, dark: string)}
  <rect x="38" y="90" width="10" height="20" rx="4" fill={dark} />
  <rect x="52" y="90" width="10" height="20" rx="4" fill={dark} />
  <path d="M33 64Q50 52 67 64L71 94Q50 101 29 94Z" fill={tunic} />
  <circle cx="50" cy="40" r="19" fill={skin[kind] ?? "#f6cda6"} />
  {@render face(50, 40)}
{/snippet}

{#snippet sleepy(cx: number, cy: number, gap = 9)}
  <path d={`M${cx - gap - 6} ${cy}a6 6 0 0 0 12 0z`} fill="#fffaf0" stroke="none" />
  <path d={`M${cx + gap - 6} ${cy}a6 6 0 0 0 12 0z`} fill="#fffaf0" stroke="none" />
  <circle cx={cx - gap} cy={cy + 2.2} r="2.3" fill={ink} stroke="none" />
  <circle cx={cx + gap} cy={cy + 2.2} r="2.3" fill={ink} stroke="none" />
  <path d={`M${cx - gap - 7} ${cy}h14M${cx + gap - 7} ${cy}h14`} fill="none" stroke="#39395f" stroke-width="2.4" paint-order="normal" />
{/snippet}

<svg class="fig" viewBox="0 0 100 124" aria-hidden="true">
  <ellipse cx="50" cy="115" rx="33" ry="7" fill="#141a35" opacity=".34" />
  <path d="M28 106h44l6 9H22z" fill={foe ? "#59597f" : "#d9b16f"} stroke={rim} stroke-width="2.5" stroke-linejoin="round" paint-order="stroke" />
  <g stroke={rim} stroke-width="3.6" stroke-linejoin="round" stroke-linecap="round" paint-order="stroke">
    {#if foe}
      {#if kind === "puff"}
        <path d="M22 100Q6 92 14 74Q6 56 26 50Q30 30 50 34Q70 30 74 50Q94 56 86 74Q94 92 78 100Q50 110 22 100Z" fill="#7377a8" />
        <path d="M30 48Q50 22 70 48Q50 42 30 48Z" fill="#a4a7cf" />
        <ellipse cx="50" cy="88" rx="22" ry="11" fill="#8f92c0" stroke="none" />
        {@render sleepy(50, 64)}
        <ellipse cx="50" cy="82" rx="5" ry="3.5" fill="#39395f" stroke="none" />
      {:else if kind === "drip"}
        <path d="M50 12Q58 40 74 60Q88 84 70 100Q50 112 30 100Q12 84 26 60Q42 40 50 12Z" fill="#5f86b8" />
        <path d="M40 92Q30 84 34 70" fill="none" stroke="#a9c8e6" stroke-width="4" paint-order="normal" />
        {@render sleepy(50, 66, 10)}
        <path d="M45 85q5 -4 10 0" fill="none" stroke="#2c3a5e" stroke-width="2.4" paint-order="normal" />
        <path d="M86 40q5 8 0 12q-5 -4 0 -12z" fill="#a9c8e6" stroke-width="2" />
      {:else if kind === "mumble"}
        <path d="M50 4Q62 30 72 54Q86 92 74 104H26Q14 92 28 54Q38 30 50 4Z" fill="#7b63ad" />
        <path d="M50 24q10 6 2 12q-9 4 -3 10q8 2 6 -4" fill="none" stroke="#c6b4ea" stroke-width="3" paint-order="normal" />
        {@render sleepy(50, 70, 10)}
        <path d="M43 88q3.500 3 7 0q3.500 -3 7 0" fill="none" stroke="#2f2450" stroke-width="2.4" paint-order="normal" />
      {:else if kind === "snuffle"}
        <path d="M18 104Q6 74 26 54Q40 38 60 42Q88 50 88 80Q88 98 76 104Z" fill="#7f8fb0" />
        <circle cx="30" cy="48" r="9" fill="#7f8fb0" />
        <circle cx="72" cy="48" r="9" fill="#7f8fb0" />
        {@render sleepy(50, 66, 12)}
        <ellipse cx="50" cy="80" rx="9" ry="7" fill="#e79a9a" stroke="none" />
        <path d="M70 84h12M76 78v12" fill="none" stroke="#fff6dd" stroke-width="4" paint-order="normal" />
      {:else if kind === "bump"}
        <rect x="22" y="92" width="11" height="17" rx="4" fill="#4d4f78" />
        <rect x="67" y="92" width="11" height="17" rx="4" fill="#4d4f78" />
        <path d="M8 86Q6 50 34 46Q50 40 66 46Q94 50 92 86Q92 102 72 102H28Q8 102 8 86Z" fill="#696b9a" />
        <path d="M28 48L20 26L42 42Z" fill="#c9c3e6" />
        <path d="M72 48L80 26L58 42Z" fill="#c9c3e6" />
        {@render sleepy(50, 68, 13)}
        <path d="M38 88q12 -7 24 0" fill="none" stroke="#2c2c50" stroke-width="3" paint-order="normal" />
      {:else if kind === "wisp"}
        <path d="M54 6Q44 26 58 38Q78 56 70 84Q64 106 44 106Q24 102 28 78Q30 60 42 48Q30 30 54 6Z" fill="#5ea3a8" />
        <path d="M54 22Q50 32 58 42" fill="none" stroke="#bfe6e4" stroke-width="3.500" paint-order="normal" />
        {@render sleepy(49, 72, 9)}
        <path d="M46 90q4 3 8 0" fill="none" stroke="#1f3f43" stroke-width="2.4" paint-order="normal" />
      {:else if kind === "flit"}
        <path d="M34 62Q8 22 2 58Q6 80 26 80Q32 78 38 72Z" fill="#a597d6" />
        <path d="M66 62Q92 22 98 58Q94 80 74 80Q68 78 62 72Z" fill="#a597d6" />
        <circle cx="50" cy="66" r="25" fill="#7c70b4" />
        <path d="M42 42q-4 -12 -10 -13M58 42q4 -12 10 -13" fill="none" stroke="#3a3366" stroke-width="3" paint-order="normal" />
        {@render sleepy(50, 62, 10)}
        <circle cx="50" cy="78" r="3.500" fill="#2e2850" stroke="none" />
        <path d="M50 92v14" fill="none" stroke="#a597d6" stroke-width="3" paint-order="normal" />
      {:else}
        <path d="M50 20Q70 22 74 48Q92 76 78 96Q66 108 50 106Q34 108 22 96Q8 76 26 48Q30 22 50 20Z" fill="#9a6fa8" />
        {@render sleepy(50, 58, 11)}
        <ellipse cx="50" cy="82" rx="10" ry="12" fill="#3a2445" stroke="none" />
        <path d="M84 20v22q0 5 -6 5t-6 -5q0 -5 6 -5l6 1" fill="#ffd778" stroke-width="2.4" />
      {/if}
      {#if captain}
        <path d="M26 42Q34 6 66 12Q84 16 90 34Q76 24 66 30Q72 38 74 44Q50 34 26 42Z" fill="#e34f6f" />
        <path d="M26 44Q50 34 74 46" fill="none" stroke="#fff6dd" stroke-width="7" paint-order="normal" />
        <circle cx="90" cy="36" r="7" fill="#ffd64a" />
      {/if}
    {:else if kind === "knight"}
      <rect x="77" y="46" width="6" height="44" rx="2" fill="#e8edf5" />
      <rect x="70" y="84" width="20" height="6" rx="2" fill="#c98a2c" />
      {@render person("#5b7fb5", "#3f5c8e")}
      <path d="M30 40a20 22 0 0 1 40 0v3H30z" fill="#a7b8d2" />
      <rect x="29" y="40" width="42" height="6" rx="2" fill="#7c90b1" />
      <path d="M50 20Q60 4 78 12Q70 16 66 24Q58 18 50 22Z" fill="#e0475f" />
      <path d="M8 62h36v20q0 16 -18 26q-18 -10 -18 -26z" fill="#3f5c8e" />
      <path d="M26 66v34M12 80h28" fill="none" stroke="#ffd25e" stroke-width="5" paint-order="normal" />
    {:else if kind === "archer"}
      <path d="M22 54l14 -30l8 3l-12 30z" fill="#8a5a32" />
      <path d="M26 24l5 -9l5 11z" fill="#f4f0e4" />
      {@render person("#4f9a5c", "#336b40")}
      <path d="M28 46Q24 12 50 12Q78 12 72 46Q66 28 50 28Q34 28 28 46Z" fill="#35784a" />
      <path d="M50 12Q66 2 74 12Q66 12 62 20Z" fill="#35784a" />
      <path d="M78 34Q102 68 78 102" fill="none" stroke="#7a4a24" stroke-width="6.500" paint-order="normal" />
      <path d="M78 34V102" fill="none" stroke="#fff6dd" stroke-width="1.800" paint-order="normal" />
      <path d="M46 70H90" fill="none" stroke="#7a4a24" stroke-width="3" paint-order="normal" />
      <path d="M90 64l9 6l-9 6z" fill="#dfe6ee" stroke-width="2" />
    {:else if kind === "mage"}
      <path d="M84 54V100" fill="none" stroke="#7b4f2c" stroke-width="5" paint-order="normal" />
      <path d="M84 34l4 9l10 1l-7 7l2 10l-9 -5l-9 5l2 -10l-7 -7l10 -1z" fill="#ffd64a" stroke-width="2.600" />
      <path d="M32 60Q50 52 68 60L78 110H22Z" fill="#8a5fd0" />
      <path d="M46 62h8l6 48H40z" fill="#b394e8" stroke="none" />
      <circle cx="50" cy="42" r="18" fill={skin.mage} />
      {@render face(50, 44)}
      <path d="M52 1L74 34Q50 42 26 34Z" fill="#6e45b8" />
      <ellipse cx="50" cy="35" rx="31" ry="7" fill="#58369c" />
      <path d="M52 13l2.500 5.500l6 .6l-4.500 4l1.300 6l-5.300 -3l-5.300 3l1.300 -6l-4.500 -4l6 -.6z" fill="#ffd64a" stroke="none" />
    {:else if kind === "healer"}
      <path d="M86 28V108" fill="none" stroke="#8a6238" stroke-width="5" paint-order="normal" />
      <path d="M86 28Q70 20 72 6Q90 6 92 22Q98 14 100 26Q94 34 86 28Z" fill="#59b56f" stroke-width="2.800" />
      {@render person("#e4789a", "#b04f72")}
      <path d="M38 66h24l4 28q-16 5 -32 0z" fill="#fff6dd" stroke="none" />
      <path d="M50 88l-8 -8a5 5 0 0 1 8 -5a5 5 0 0 1 8 5z" fill="#e0475f" stroke="none" />
      <path d="M29 34Q30 14 50 14Q70 14 71 34Q50 24 29 34Z" fill="#fff6dd" />
      <path d="M50 28l-5 -5a3 3 0 0 1 5 -3a3 3 0 0 1 5 3z" fill="#e0475f" stroke="none" />
    {:else if kind === "rider"}
      <path d="M10 66Q0 74 5 90Q13 84 15 74Z" fill="#6e4322" />
      <rect x="20" y="84" width="9" height="24" rx="3.500" fill="#8a5428" />
      <rect x="35" y="86" width="9" height="22" rx="3.500" fill="#774620" />
      <rect x="60" y="86" width="9" height="22" rx="3.500" fill="#774620" />
      <rect x="74" y="84" width="9" height="24" rx="3.500" fill="#8a5428" />
      <ellipse cx="48" cy="76" rx="37" ry="18" fill="#c7753a" />
      <path d="M72 70Q78 48 86 42L99 54Q98 62 90 62Q86 72 82 82Z" fill="#c7753a" />
      <path d="M85 44l1 -10l6 9z" fill="#c7753a" />
      <path d="M72 66Q72 48 84 40Q78 54 80 68Z" fill="#6e4322" />
      <circle cx="91" cy="51" r="2" fill={ink} stroke="none" />
      <path d="M28 66h36v12H28z" fill="#e0475f" />
      <path d="M32 58Q46 44 60 58L62 72H30Z" fill="#d8893f" />
      <circle cx="46" cy="34" r="16" fill={skin.rider} />
      {@render face(46, 34)}
      <path d="M29 30Q30 13 46 13Q62 13 63 30Z" fill="#8e3a2e" />
      <path d="M12 8L24 66" fill="none" stroke="#7a4a24" stroke-width="4" paint-order="normal" />
      <path d="M12 8l18 6l-15 8z" fill="#ffd25e" stroke-width="2.400" />
    {:else if kind === "scout"}
      <path d="M58 62Q80 52 96 64Q84 68 78 76Q70 68 58 72Z" fill="#f08a3c" />
      {@render person("#2fa79b", "#1e7a72")}
      <path d="M33 64Q50 72 67 64L66 74Q50 82 34 74Z" fill="#f08a3c" />
      <path d="M29 42Q26 26 30 8L44 22Q50 20 56 22L70 8Q74 26 71 42Q64 28 50 28Q36 28 29 42Z" fill="#23897f" />
      <path d="M33 14l6 9l-6 3zM67 14l-6 9l6 3z" fill="#ffd9b0" stroke="none" />
      <path d="M16 96L28 66l6 3L22 98z" fill="#e8edf5" stroke-width="2.800" />
      <rect x="14" y="94" width="13" height="6" rx="2" transform="rotate(20 20 97)" fill="#7a4a24" stroke-width="2" />
    {:else if kind === "flyer"}
      <path d="M38 62Q14 20 0 44Q2 56 12 58Q4 64 10 76Q20 76 24 72Q24 84 34 84Q40 76 42 70Z" fill="#dff2fc" />
      <path d="M62 62Q86 20 100 44Q98 56 88 58Q96 64 90 76Q80 76 76 72Q76 84 66 84Q60 76 58 70Z" fill="#dff2fc" />
      <path d="M36 66Q50 56 64 66L60 92Q50 98 40 92Z" fill="#58b6e8" />
      <circle cx="50" cy="42" r="18" fill={skin.flyer} />
      {@render face(50, 45)}
      <path d="M31 38Q32 20 50 20Q68 20 69 38Z" fill="#2e7fb4" />
      <circle cx="41" cy="33" r="6.500" fill="#ffd25e" stroke-width="2.400" />
      <circle cx="59" cy="33" r="6.500" fill="#ffd25e" stroke-width="2.400" />
      <path d="M34 104Q28 96 38 94Q42 86 52 90Q62 86 66 96Q74 98 68 106Z" fill="#fffaf0" stroke="#bcd8ea" stroke-width="2" />
    {:else}
      {@render person("#eeaa2e", "#b57a16")}
      <path d="M40 58l5 40M52 56l3 42M62 60l-2 36" fill="none" stroke="#d98e1a" stroke-width="3" paint-order="normal" />
      <path d="M28 34Q26 18 48 16Q74 14 76 32Q54 26 28 34Z" fill="#c8384f" />
      <path d="M68 24Q86 8 96 2Q94 18 78 30Z" fill="#54c0ae" stroke-width="2.600" />
      <ellipse cx="34" cy="82" rx="19" ry="17" fill="#a8672e" transform="rotate(-24 34 82)" />
      <circle cx="35" cy="81" r="6" fill="#4b2c14" stroke="none" />
      <path d="M46 72L78 48" fill="none" stroke="#7a4a24" stroke-width="7" paint-order="normal" />
      <path d="M76 42l9 3l-3 10l-8 -3z" fill="#7a4a24" stroke-width="2" />
      <path d="M90 62v15q0 4 -5 4t-5 -4q0 -4 5 -4l5 1" fill="#ffd64a" stroke-width="2.200" />
    {/if}
    {#if captain && !foe}
      <path d="M32 18l4 -13l8 8l6 -11l6 11l8 -8l4 13q-18 -6 -36 0Z" fill="#ffd64a" stroke-width="2.800" />
    {/if}
  </g>
</svg>
