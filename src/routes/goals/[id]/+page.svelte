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
    <div class="flex flex-col gap-5 pt-4">
      <div class="flex items-center justify-between">
        <button class="btn btn-ghost btn-sm px-0 text-base-content/40" onclick={() => goto('/goals')}>← Goals</button>
        <button class="btn btn-ghost btn-sm text-error" onclick={handleDelete}>Delete</button>
      </div>

      <div class="flex items-center gap-3 flex-wrap">
        <h2 class="text-xl font-bold">{goal.name}</h2>
        <div class="badge badge-outline badge-sm {goal.orientation === 'performance' ? 'badge-warning' : ''}">
          {goal.orientation}
        </div>
      </div>

      {#if goal.description}
        <p class="text-sm text-base-content/60 leading-relaxed">{goal.description}</p>
      {/if}

      {#if goal.motivation}
        <p class="text-sm text-base-content/50 italic">Why: {goal.motivation}</p>
      {/if}

      <div class="divider my-0"></div>

      <MilestoneList {milestones} onadd={handleAddMilestone} ontoggle={handleToggleMilestone} />
      <SessionLog {sessions} orientation={goal.orientation} onadd={handleAddSession} />
    </div>
  {:else}
    <div class="flex items-center justify-center h-full">
      <span class="loading loading-spinner loading-md text-base-content/30"></span>
    </div>
  {/if}
</AuthGuard>
