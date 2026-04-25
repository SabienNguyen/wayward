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
      error = 'Sign in failed. Please try again.';
    }
  }
</script>

<div class="flex flex-col items-center justify-center min-h-[70vh] text-center gap-10 animate-fade-up">
  <div class="flex flex-col items-center gap-3">
    <div class="text-base-content/20 text-3xl tracking-[0.3em] mb-2">◆</div>
    <h1 class="font-['Cormorant'] text-6xl font-light tracking-wide text-base-content">
      Wayward
    </h1>
    <p class="font-['Crimson_Pro'] italic text-base-content/40 text-lg tracking-wide">
      a place for goals that matter
    </p>
  </div>

  <div class="flex flex-col items-center gap-3">
    {#if error}
      <p class="font-['Crimson_Pro'] text-error/80 text-sm italic">{error}</p>
    {/if}
    <button
      onclick={handleSignIn}
      class="font-['Crimson_Pro'] text-base tracking-widest uppercase text-base-content/50
             border border-base-content/20 px-8 py-3
             hover:border-base-content/50 hover:text-base-content/80
             transition-all duration-300"
    >
      Continue with Google
    </button>
  </div>
</div>
