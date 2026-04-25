<script lang="ts">
  import { authStore } from '$lib/stores/auth.svelte';
  import '../app.css';

  let { children } = $props();

  $effect(() => {
    document.documentElement.setAttribute('data-theme', 'coffee');
  });
</script>

<div class="flex flex-col h-full">
  <div class="navbar bg-base-100 border-b border-base-300 shadow-sm min-h-12 px-4">
    <div class="navbar-start">
      <span class="font-bold text-base tracking-tight">◆ Wayward</span>
    </div>
    <div class="navbar-end gap-1">
      {#if authStore.user}
        <button class="btn btn-ghost btn-sm text-base-content/50" onclick={() => authStore.signOut()}>
          Sign out
        </button>
      {/if}
    </div>
  </div>

  <main class="flex-1 overflow-y-auto py-5 px-4 max-w-2xl w-full mx-auto">
    {@render children()}
  </main>
</div>
