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
    } catch {
      error = 'Failed to save goal. Try again.';
      saving = false;
    }
  }
</script>

<AuthGuard>
  <div class="new-goal-page">
    <div class="page-header">
      <button class="btn-back" onclick={() => goto('/goals')}>← Back</button>
      <h2 class="section-heading">New Goal</h2>
    </div>

    {#if error}<p class="error">{error}</p>{/if}
    {#if saving}
      <p class="muted">Saving...</p>
    {:else}
      <GoalForm onsubmit={handleSubmit} />
    {/if}
  </div>
</AuthGuard>

<style>
  .new-goal-page {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding-top: 16px;
  }

  .page-header {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .btn-back {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 14px;
    cursor: pointer;
    padding: 0;
  }

  .error {
    color: var(--error, #e05);
    font-size: 13px;
  }

  .muted {
    color: var(--text-muted);
    font-size: 14px;
  }
</style>
