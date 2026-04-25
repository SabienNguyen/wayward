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

<div class="flex items-center justify-center h-full">
  <div class="card bg-base-100 border border-base-300 shadow-xl w-full max-w-sm">
    <div class="card-body items-center text-center gap-4">
      <span class="text-2xl font-bold tracking-tight">◆ Wayward</span>
      <p class="text-base-content/50 text-sm">Plan goals that matter.</p>
      {#if error}
        <div class="alert alert-error py-2 text-sm">{error}</div>
      {/if}
      <button class="btn btn-primary w-full" onclick={handleSignIn}>
        Sign in with Google
      </button>
    </div>
  </div>
</div>
