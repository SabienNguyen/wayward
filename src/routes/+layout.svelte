<script lang="ts">
  import { authStore } from '$lib/stores/auth.svelte';
  import '../app.css';

  let { children } = $props();

  $effect(() => {
    document.documentElement.setAttribute('data-theme', 'coffee');
  });
</script>

<div class="flex flex-col h-full">
  <header class="flex items-center justify-between px-6 py-4 border-b border-base-300/40">
    <span class="font-['Cormorant'] text-xl font-light tracking-[0.15em] text-base-content/70 uppercase">
      Wayward
    </span>
    {#if authStore.user}
      <button
        class="font-['Crimson_Pro'] text-sm text-base-content/30 hover:text-base-content/60 transition-colors tracking-wide"
        onclick={() => authStore.signOut()}
      >
        sign out
      </button>
    {/if}
  </header>

  <main class="flex-1 overflow-y-auto">
    <div class="max-w-xl w-full mx-auto px-6 py-8">
      {@render children()}
    </div>
  </main>
</div>
