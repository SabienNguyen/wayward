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
  <div class="flex flex-col pt-2 animate-fade-up">
    <div class="flex items-baseline justify-between mb-8">
      <h2 class="font-['Cormorant'] text-3xl font-light text-base-content/80">Your Goals</h2>
      <button
        onclick={() => goto('/goals/new')}
        class="font-['Crimson_Pro'] text-xs tracking-widest uppercase text-base-content/35
               hover:text-base-content/70 transition-colors"
      >
        + new
      </button>
    </div>

    {#if goalsStore.goals.length > 0}
      <div>
        {#each goalsStore.goals as goal (goal.id)}
          <GoalCard {goal} onclick={() => goto(`/goals/${goal.id}`)} />
        {/each}
      </div>
    {:else}
      <div class="flex flex-col items-center gap-3 py-20 text-center">
        <span class="font-['Cormorant'] text-4xl font-light italic text-base-content/20">
          nothing yet
        </span>
        <p class="font-['Crimson_Pro'] italic text-sm text-base-content/30">
          Start with something that genuinely matters to you.
        </p>
        <button
          onclick={() => goto('/goals/new')}
          class="mt-4 font-['Crimson_Pro'] text-xs tracking-widest uppercase text-base-content/30
                 border border-base-content/15 px-6 py-2
                 hover:border-base-content/40 hover:text-base-content/60
                 transition-all duration-200"
        >
          Set a goal
        </button>
      </div>
    {/if}
  </div>
</AuthGuard>
