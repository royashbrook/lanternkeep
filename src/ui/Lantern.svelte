<script lang="ts">
  let { lit = true, big = false }: { lit?: boolean; big?: boolean } = $props();
</script>

<svg class="lantern" class:big class:lit viewBox="0 0 120 170" aria-hidden="true">
  <g stroke="#fff6dd" stroke-width="3.500" stroke-linejoin="round" stroke-linecap="round" paint-order="stroke">
    <path d="M44 22Q60 2 76 22" fill="none" stroke="#3b3560" stroke-width="7" paint-order="normal" />
    <path d="M34 22h52l8 18H26z" fill="#3b3560" />
    <path d="M32 40h56l6 84H26z" fill={lit ? "#ffcf5c" : "#465480"} />
    {#if lit}
      <path class="flame" d="M60 58Q78 82 72 100Q68 116 60 116Q52 116 48 100Q42 82 60 58Z" fill="#ff8a3d" stroke="#fff1b8" stroke-width="3" />
      <path class="flame" d="M60 82Q68 94 65 104Q63 112 60 112Q57 112 55 104Q52 94 60 82Z" fill="#fff6c9" stroke="none" />
    {:else}
      <path d="M60 106q-5 -8 0 -14q5 6 0 14z" fill="#2a3358" stroke="none" />
    {/if}
    <path d="M46 40l-4 84M74 40l4 84" fill="none" stroke="#3b3560" stroke-width="4" paint-order="normal" />
    <path d="M22 124h76l-6 20H28z" fill="#3b3560" />
    <path d="M44 144h32l-4 12H48z" fill="#2a2548" />
  </g>
</svg>
