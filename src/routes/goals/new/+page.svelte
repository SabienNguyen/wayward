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
      error = e instanceof Error ? e.message : 'Failed to save goal. Try again.';
      saving = false;
    }
  }
</script>

<AuthGuard>
  <div class="flex flex-col gap-6 pt-4">
    <div class="flex items-center gap-3">
      <button class="btn btn-ghost btn-sm px-0 text-base-content/40" onclick={() => goto('/goals')}>← Back</button>
      <span class="text-xs font-bold uppercase tracking-widest text-base-content/40">New Goal</span>
    </div>

    {#if error}
      <div class="alert alert-error text-sm">{error}</div>
    {/if}

    {#if saving}
      <div class="flex items-center gap-2 text-sm text-base-content/40">
        <span class="loading loading-spinner loading-sm"></span> Saving...
      </div>
    {:else}
      <GoalForm onsubmit={handleSubmit} />
    {/if}
  </div>
</AuthGuard>
