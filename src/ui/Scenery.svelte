<script lang="ts">
  // layered cut-paper country behind the title and the battles: stars, clouds of gloom, hills,
  // and a little village far off. it is cropped to fit, so every screen shape sees a full picture.
  let { variant }: { variant: "title" | "battle" } = $props();
  const stars = [[90, 120], [240, 60], [380, 170], [520, 70], [690, 130], [840, 50], [980, 150], [1120, 90], [160, 280], [450, 300], [760, 270], [1060, 300], [320, 400], [900, 410], [600, 220]];
  const cloud = "M0 44q2-22 26-22q10-22 38-16q18-20 46-4q26-8 36 16q24 2 24 26q-2 10-14 10H12q-12-2-12-10z";
  const homes = [[210, 742, 1], [262, 750, 0.8], [950, 716, 1.1], [1006, 728, 0.8], [905, 730, 0.75]];
  const tufts = [[150, 520, 1.2], [90, 760, 1], [240, 900, 1.3], [420, 1010, 1], [760, 1020, 1.2], [980, 900, 1], [1100, 720, 1.3], [1060, 500, 1], [820, 340, 0.9], [360, 350, 1], [600, 300, 0.8], [600, 1060, 1.1]];
</script>

<svg class="scenery" class:battlebg={variant === "battle"} viewBox="0 0 1200 1200" preserveAspectRatio={variant === "battle" ? "xMidYMid slice" : "xMidYMax slice"} aria-hidden="true">
  <defs>
    <linearGradient id={`sky-${variant}`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#16213f" />
      <stop offset=".62" stop-color="#2c3f73" />
      <stop offset="1" stop-color="#3f4f88" />
    </linearGradient>
  </defs>
  <rect width="1200" height="1200" fill={`url(#sky-${variant})`} />
  {#if variant === "title"}
    {#each stars as [x, y], i (i)}
      <path d={`M${x} ${y - 7}l2 5 5 2-5 2-2 5-2-5-5-2 5-2z`} fill="#ffe9ad" opacity={0.45 + (i % 3) * 0.2} />
    {/each}
    <circle cx="985" cy="205" r="62" fill="#fff0c4" stroke="#fff6dd" stroke-width="5" />
    <circle cx="1010" cy="190" r="54" fill="#1e2c50" />
    <g fill="#8fa3cf">
      <path d={cloud} transform="translate(70 330) scale(1.5)" opacity=".34" />
      <path d={cloud} transform="translate(720 420) scale(1.9)" opacity=".28" />
      <path d={cloud} transform="translate(380 520) scale(1.15)" opacity=".22" />
    </g>
    <path d="M0 790Q180 640 420 730T820 700T1200 690V1200H0Z" fill="#3d5590" stroke="#fff6dd" stroke-opacity=".5" stroke-width="4" />
    {#each homes as [x, y, s], i (i)}
      <g transform={`translate(${x} ${y}) scale(${s})`} stroke="#fff6dd" stroke-opacity=".7" stroke-width="2" stroke-linejoin="round" paint-order="stroke">
        <path d="M-20 22V-4L0-22l20 18V22z" fill="#2c3f73" />
        <rect x="-5" y="2" width="10" height="11" fill="#ffd25e" stroke="none" />
      </g>
    {/each}
    <path d="M0 880Q240 760 520 850T960 820T1200 840V1200H0Z" fill="#2d4378" stroke="#fff6dd" stroke-opacity=".45" stroke-width="4" />
    {#each [[70, 850], [150, 830], [1100, 815], [1020, 830], [1160, 840]] as [x, y], i (i)}
      <path d={`M${x} ${y - 56}l26 40h-13l19 28h-64l19-28h-13z`} fill="#2f6f69" stroke="#d9efe0" stroke-opacity=".7" stroke-width="3" stroke-linejoin="round" paint-order="stroke" />
    {/each}
    <path d="M0 990Q300 890 640 970T1200 950V1200H0Z" fill="#233464" stroke="#fff6dd" stroke-opacity=".35" stroke-width="4" />
    <path d="M0 1090Q360 1020 760 1090T1200 1070V1200H0Z" fill="#1a2750" />
  {:else}
    <!-- a quiet stage: one soft ground for both sides, nothing behind a fighter to read as a fighter -->
    <path d="M0 420Q300 340 600 400T1200 370V1200H0Z" fill="#2a3c6e" />
    <ellipse cx="600" cy="640" rx="760" ry="470" fill="#34497f" />
    <ellipse cx="600" cy="640" rx="520" ry="320" fill="#3d5590" />
    {#each tufts as [x, y, s], i (i)}
      <path d={`M${x - 14 * s} ${y}q${4 * s} ${-16 * s} ${8 * s} ${-22 * s}q${2 * s} ${10 * s} ${6 * s} ${12 * s}q${3 * s} ${-12 * s} ${9 * s} ${-18 * s}q${1 * s} ${14 * s} ${5 * s} ${28 * s}z`} fill="#4f6da6" opacity=".75" />
    {/each}
  {/if}
</svg>
