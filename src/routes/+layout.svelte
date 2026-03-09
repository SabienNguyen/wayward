<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import GoalsStrip from '$lib/components/GoalsStrip.svelte';
  import '../app.css';

  let theme: 'light' | 'dark' = 'light';

  onMount(() => {
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

  $: mode = $page.url.pathname.startsWith('/journal') ? 'journal' : 'do';
</script>

<div class="app-shell">
  <header class="app-header">
    <span class="logo">◆ Wayward</span>
    <button class="theme-toggle btn-ghost" on:click={toggleTheme} aria-label="Toggle theme">
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  </header>

  <div class="goals-bar">
    <GoalsStrip />
  </div>

  <div class="mode-toggle-bar">
    <div class="mode-toggle">
      <button
        class="mode-btn"
        class:active={mode === 'do'}
        on:click={() => goto('/do')}
      >
        Do
      </button>
      <button
        class="mode-btn"
        class:active={mode === 'journal'}
        on:click={() => goto('/journal')}
      >
        Journal
      </button>
    </div>
  </div>

  <main class="app-content">
    <slot />
  </main>
</div>

<style>
  .app-shell {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  /* Header */
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

  .theme-toggle {
    font-size: 16px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
  }

  /* Goals bar */
  .goals-bar {
    background: var(--surface-2);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  /* Mode toggle */
  .mode-toggle-bar {
    display: flex;
    justify-content: center;
    padding: 12px 0 0;
    background: var(--bg);
    flex-shrink: 0;
  }

  .mode-toggle {
    display: flex;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 99px;
    padding: 3px;
    gap: 2px;
    box-shadow: var(--shadow);
  }

  .mode-btn {
    padding: 5px 22px;
    border-radius: 99px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-muted);
    background: transparent;
    transition: all 0.15s ease;
  }

  .mode-btn:hover:not(.active) {
    background: var(--surface-2);
    color: var(--text);
  }

  .mode-btn.active {
    background: var(--accent);
    color: #fff;
  }

  /* Content area */
  .app-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    max-width: 720px;
    width: 100%;
    margin: 0 auto;
  }
</style>
