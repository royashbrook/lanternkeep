<script lang="ts">
  // a small shape for each class, so class never depends on colour alone
  let { cls }: { cls: string } = $props();
  const paths: Record<string, string> = {
    knight: "M4 3h16v8c0 5-4 8-8 10-4-2-8-5-8-10z",
    archer: "M3 21L16 8M16 8l-1-5 6-1-1 6zM3 21l1-5M3 21l5-1",
    mage: "M12 2l3 6.500 7 .9-5 4.900 1.300 7L12 18l-6.300 3.300 1.300-7-5-4.900 7-.9z",
    healer: "M12 21l-1.500-1.300C5.400 15.300 2 12.300 2 8.500 2 5.400 4.400 3 7.500 3c1.700 0 3.400.8 4.500 2.100C13.100 3.800 14.800 3 16.500 3 19.600 3 22 5.400 22 8.500c0 3.800-3.400 6.800-8.500 11.200z",
    rider: "M6 21V10a6 6 0 0 1 12 0v11h-4V10a2 2 0 0 0-4 0v11z",
    scout: "M12 2l8 10-8 10-8-10z",
    flyer: "M2 7c6 0 9 2 10 6 1-4 4-6 10-6-1 7-5 11-10 13C7 18 3 14 2 7z",
    bard: "M9 18a3 3 0 1 1-2-2.800V4l12-2v13a3 3 0 1 1-2-2.800V6.300L9 7.700z",
  };
</script>

<svg class="badge" viewBox="0 0 24 24" aria-hidden="true"><path d={paths[cls] ?? paths.scout} /></svg>
