<script lang="ts">
  import { onMount, type Snippet } from "svelte";
  // one modal for everything: the browser's own dialog traps focus and closes on escape
  let { label, onClose, children }: { label: string; onClose: () => void; children: Snippet } = $props();
  let box = $state<HTMLDialogElement>();
  onMount(() => box?.showModal());
</script>

<dialog bind:this={box} class="sheet" aria-label={label} onclose={onClose}>
  <div class="card">{@render children()}</div>
</dialog>
