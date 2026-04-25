<script lang="ts">
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import { goalsStore } from '$lib/stores/goals.svelte';
  import GoalForm from '$lib/components/GoalForm.svelte';
  import AuthGuard from '$lib/components/AuthGuard.svelte';
  import type { GoalFormData } from '$lib/types';

  let saving = $state(false);
  let error = $state<string | null>(null);

  async function handleSubmit(data: GoalFormData & { orientation: 'performance' | 'learning' }) {
    if (!authStore.user) return;
    saving = true;
    error = null;
    try {
      await goalsStore.create(authStore.user.uid, data);
      goto('/goals');
    } catch (e) {
      console.error('Goal save failed:', e);
      error = e instanceof Error ? e.message : 'Failed to save. Try again.';
      saving = false;
    }
  }
</script>

<AuthGuard>
  <div class="flex flex-col gap-8 pt-2 animate-fade-up">
    <div class="flex items-baseline gap-4">
      <button
        onclick={() => goto('/goals')}
        class="font-['Crimson_Pro'] text-xs tracking-widest uppercase text-base-content/25
               hover:text-base-content/60 transition-colors"
      >
        ← back
      </button>
      <h2 class="font-['Cormorant'] text-3xl font-light text-base-content/80">New Goal</h2>
    </div>

    {#if error}
      <p class="font-['Crimson_Pro'] italic text-error/70 text-sm">{error}</p>
    {/if}

    {#if saving}
      <p class="font-['Crimson_Pro'] italic text-base-content/30 text-sm tracking-widest">saving...</p>
    {:else}
      <GoalForm onsubmit={handleSubmit} />
    {/if}
  </div>
</AuthGuard>
