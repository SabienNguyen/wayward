<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import { goalsStore } from '$lib/stores/goals.svelte';
  import GoalCard from '$lib/components/GoalCard.svelte';
  import AuthGuard from '$lib/components/AuthGuard.svelte';

  onMount(() => {
    if (authStore.user) goalsStore.load(authStore.user.uid);
  });
</script>

<AuthGuard>
  <div class="goals-page">
    <div class="page-header">
      <h2 class="section-heading">Your Goals</h2>
      <button class="btn-primary" onclick={() => goto('/goals/new')}>+ New Goal</button>
    </div>

    <div class="goals-list">
      {#each goalsStore.goals as goal (goal.id)}
        <GoalCard {goal} onclick={() => goto(`/goals/${goal.id}`)} />
      {:else}
        <div class="empty-state">
          <p>No goals yet.</p>
          <p class="muted">Start with something that genuinely matters to you.</p>
        </div>
      {/each}
    </div>
  </div>
</AuthGuard>

<style>
  .goals-page {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding-top: 16px;
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .goals-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .btn-primary {
    padding: 8px 16px;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: var(--radius);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }

  .empty-state {
    text-align: center;
    padding: 48px 20px;
    color: var(--text);
  }

  .muted {
    color: var(--text-muted);
    font-size: 14px;
  }
</style>
