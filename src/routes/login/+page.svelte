<script lang="ts">
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';

  let error = $state<string | null>(null);

  $effect(() => {
    if (authStore.user) goto('/goals');
  });

  async function handleSignIn() {
    error = null;
    try {
      await authStore.signIn();
    } catch {
      error = 'Sign in failed. Try again.';
    }
  }
</script>

<div class="login-page">
  <div class="login-card">
    <span class="logo">◆ Wayward</span>
    <p class="tagline">Plan goals that matter.</p>
    {#if error}<p class="error">{error}</p>{/if}
    <button class="btn-primary" onclick={handleSignIn}>Sign in with Google</button>
  </div>
</div>

<style>
  .login-page {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }

  .login-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 48px 40px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-md);
    text-align: center;
  }

  .logo {
    font-size: 22px;
    font-weight: 700;
    color: var(--accent);
  }

  .tagline {
    color: var(--text-muted);
    font-size: 14px;
  }

  .error {
    color: var(--error, #e05);
    font-size: 13px;
  }

  .btn-primary {
    padding: 10px 24px;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: var(--radius);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
</style>
