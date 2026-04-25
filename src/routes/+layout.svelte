<script lang="ts">
  import { authStore } from '$lib/stores/auth.svelte';
  import '../app.css';

  let { children } = $props();

  let isDark = $state(false);

  $effect(() => {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    isDark = saved ? saved === 'dim' : prefersDark;
    document.documentElement.setAttribute('data-theme', isDark ? 'dim' : 'silk');
  });

  function toggleTheme() {
    isDark = !isDark;
    const theme = isDark ? 'dim' : 'silk';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }
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
      <button class="btn btn-ghost btn-circle btn-sm" onclick={toggleTheme} aria-label="Toggle theme">
        {isDark ? '☀' : '☾'}
      </button>
    </div>
  </div>

  <main class="flex-1 overflow-y-auto py-5 px-4 max-w-2xl w-full mx-auto">
    {@render children()}
  </main>
</div>
