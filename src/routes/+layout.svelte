<script lang="ts">
  import { authStore } from '$lib/stores/auth.svelte';
  import '../app.css';

  let { children } = $props();

  let theme = $state<'light' | 'dark'>('light');

  $effect(() => {
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    theme = saved ?? (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  });

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }
</script>

<div class="app-shell">
  <header class="app-header">
    <span class="logo">◆ Wayward</span>
    <div class="header-actions">
      {#if authStore.user}
        <button class="btn-ghost sign-out" onclick={() => authStore.signOut()}>Sign out</button>
      {/if}
      <button class="theme-toggle btn-ghost" onclick={toggleTheme} aria-label="Toggle theme">
        {theme === 'dark' ? '☀' : '☾'}
      </button>
    </div>
  </header>

  <main class="app-content">
    {@render children()}
  </main>
</div>

<style>
  .app-shell {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    height: 48px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    box-shadow: var(--shadow);
    flex-shrink: 0;
  }

  .logo {
    font-size: 16px;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: var(--accent);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .theme-toggle {
    font-size: 16px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
  }

  .sign-out {
    font-size: 13px;
    color: var(--text-muted);
    padding: 4px 10px;
  }

  .btn-ghost {
    background: transparent;
    border: none;
    cursor: pointer;
  }

  .app-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    max-width: 720px;
    width: 100%;
    margin: 0 auto;
  }
</style>
