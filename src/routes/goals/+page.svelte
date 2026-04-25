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
  <div class="flex flex-col gap-5 pt-4">
    <div class="flex items-center justify-between">
      <span class="text-xs font-bold uppercase tracking-widest text-base-content/40">Your Goals</span>
      <button class="btn btn-primary btn-sm" onclick={() => goto('/goals/new')}>+ New Goal</button>
    </div>

    <div class="flex flex-col gap-2">
      {#each goalsStore.goals as goal (goal.id)}
        <GoalCard {goal} onclick={() => goto(`/goals/${goal.id}`)} />
      {:else}
        <div class="flex flex-col items-center gap-2 py-16 text-center">
          <p class="text-base-content/60">No goals yet.</p>
          <p class="text-sm text-base-content/40">Start with something that genuinely matters to you.</p>
        </div>
      {/each}
    </div>
  </div>
</AuthGuard>
