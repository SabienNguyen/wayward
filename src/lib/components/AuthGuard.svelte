<script lang="ts">
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();

  $effect(() => {
    if (!authStore.loading && !authStore.user) {
      goto('/login');
    }
  });
</script>

{#if authStore.user}
  {@render children()}
{:else if authStore.loading}
  <div class="loading-screen">Loading...</div>
{/if}

<style>
  .loading-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-muted);
  }
</style>
