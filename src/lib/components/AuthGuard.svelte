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
  <div class="flex items-center justify-center h-full">
    <span class="loading loading-spinner loading-md text-base-content/30"></span>
  </div>
{/if}
