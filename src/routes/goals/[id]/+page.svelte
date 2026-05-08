<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import { goalsStore } from '$lib/stores/goals.svelte';
  import AuthGuard from '$lib/components/AuthGuard.svelte';
  import MilestoneList from '$lib/components/MilestoneList.svelte';
  import SessionLog from '$lib/components/SessionLog.svelte';
  import { loadSessions, addSession } from '$lib/firestore/sessions';
  import { loadMilestones, addMilestone, toggleMilestone } from '$lib/firestore/milestones';
  import type { Session, Milestone } from '$lib/types';

  const goalId = $derived(page.params.id ?? '');
  const goal = $derived(goalsStore.goals.find(g => g.id === goalId));

  let sessions = $state<Session[]>([]);
  let milestones = $state<Milestone[]>([]);

  onMount(async () => {
    if (!authStore.user) return;
    const uid = authStore.user.uid;
    if (goalsStore.goals.length === 0) await goalsStore.load(uid);
    [sessions, milestones] = await Promise.all([
      loadSessions(uid, goalId),
      loadMilestones(uid, goalId),
    ]);
  });

  async function handleAddSession(content: string) {
    if (!authStore.user) return;
    const uid = authStore.user.uid;
    await addSession(uid, goalId, content);
    sessions = await loadSessions(uid, goalId);
  }

  async function handleAddMilestone(name: string) {
    if (!authStore.user) return;
    const uid = authStore.user.uid;
    await addMilestone(uid, goalId, name);
    milestones = await loadMilestones(uid, goalId);
  }

  async function handleToggleMilestone(id: string, completed: boolean) {
    if (!authStore.user) return;
    await toggleMilestone(authStore.user.uid, goalId, id, completed);
    milestones = milestones.map(m => m.id === id ? { ...m, completed } : m);
  }

  async function handleDelete() {
    if (!authStore.user || !confirm('Delete this goal?')) return;
    await goalsStore.remove(authStore.user.uid, goalId);
    goto('/goals');
  }
</script>

<AuthGuard>
  {#if goal}
    <div class="flex flex-col gap-10 pt-2 animate-fade-up">

      <!-- Nav bar -->
      <div class="flex items-center justify-between">
        <button
          onclick={() => goto('/goals')}
          class="font-['Crimson_Pro'] text-xs tracking-widest uppercase text-base-content/25
                 hover:text-base-content/60 transition-colors"
        >
          ← goals
        </button>
        <button
          onclick={handleDelete}
          class="font-['Crimson_Pro'] text-xs tracking-widest uppercase text-base-content/20
                 hover:text-error/60 transition-colors"
        >
          delete
        </button>
      </div>

      <!-- Chapter heading -->
      <div class="animate-fade-up-delay-1">
        <p class="font-['Crimson_Pro'] text-xs tracking-[0.15em] uppercase text-primary/60 mb-3">
          {goal.orientation}
        </p>
        <h1 class="font-['Cormorant'] text-5xl font-light leading-[1.1] text-base-content">
          {goal.name}
        </h1>
        {#if goal.description}
          <p class="font-['Crimson_Pro'] italic text-base text-base-content/45 mt-4 leading-relaxed">
            {goal.description}
          </p>
        {/if}
        {#if goal.motivation}
          <p class="font-['Crimson_Pro'] text-sm text-base-content/35 mt-2 leading-relaxed">
            <span class="italic">Why:</span> {goal.motivation}
          </p>
        {/if}
      </div>

      <!-- Divider -->
      <div class="border-t border-base-content/10 animate-fade-up-delay-2"></div>

      <!-- Milestones -->
      <div class="animate-fade-up-delay-2">
        <MilestoneList {milestones} onadd={handleAddMilestone} ontoggle={handleToggleMilestone} />
      </div>

      <!-- Session log -->
      <div class="animate-fade-up-delay-3">
        <SessionLog {sessions} orientation={goal.orientation} onadd={handleAddSession} />
      </div>

    </div>
  {:else}
    <div class="flex items-center justify-center min-h-[40vh]">
      <span class="font-['Crimson_Pro'] italic text-sm text-base-content/25 tracking-widest">
        loading...
      </span>
    </div>
  {/if}
</AuthGuard>
