<script lang="ts">
  // each band carries its own flag: a different cut as well as a different colour
  let { band }: { band: number } = $props();
  const fills = ["#ffb83d", "#54c0ae", "#e8638a", "#9d8bea"];
  const cuts = ["M6 3h15l-5 5 5 5H6z", "M6 3l15 5-15 5z", "M6 3h15v10H6z", "M6 3h12a5 5 0 0 1 0 10H6z"];
  const i = $derived((band - 1) % 4);
</script>

<svg class="flag" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M5 2v20" stroke="#fff6dd" stroke-width="2.600" stroke-linecap="round" fill="none" />
  <path d={cuts[i]} fill={fills[i]} stroke="#fff6dd" stroke-width="1.400" stroke-linejoin="round" paint-order="stroke" />
</svg>
