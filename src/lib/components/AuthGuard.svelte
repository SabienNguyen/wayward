<script lang="ts">
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();

  $effect(() => {
    if (!authStore.loading && !authStore.user) goto('/login');
  });
</script>

{#if authStore.user}
  {@render children()}
{:else if authStore.loading}
  <div class="flex items-center justify-center min-h-[40vh]">
    <span class="font-['Crimson_Pro'] italic text-sm text-base-content/25 tracking-widest">
      loading...
    </span>
  </div>
{/if}
