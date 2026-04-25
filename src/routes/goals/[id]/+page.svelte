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
    <div class="goal-detail">
      <div class="detail-header">
        <button class="btn-back" onclick={() => goto('/goals')}>← Goals</button>
        <button class="btn-delete" onclick={handleDelete}>Delete</button>
      </div>

      <div class="goal-meta">
        <h2>{goal.name}</h2>
        <span class="orientation-badge" class:performance={goal.orientation === 'performance'}>
          {goal.orientation}
        </span>
      </div>

      {#if goal.description}
        <p class="description">{goal.description}</p>
      {/if}

      {#if goal.motivation}
        <p class="motivation"><em>Why: {goal.motivation}</em></p>
      {/if}

      <MilestoneList
        {milestones}
        onadd={handleAddMilestone}
        ontoggle={handleToggleMilestone}
      />

      <SessionLog
        {sessions}
        orientation={goal.orientation}
        onadd={handleAddSession}
      />
    </div>
  {:else}
    <p class="muted">Loading...</p>
  {/if}
</AuthGuard>

<style>
  .goal-detail {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding-top: 16px;
  }

  .detail-header {
    display: flex;
    justify-content: space-between;
  }

  .btn-back, .btn-delete {
    background: none;
    border: none;
    font-size: 14px;
    cursor: pointer;
    padding: 0;
  }

  .btn-back { color: var(--text-muted); }
  .btn-delete { color: #ef4444; }

  .goal-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  h2 {
    font-size: 22px;
    font-weight: 700;
    color: var(--text);
    margin: 0;
  }

  .orientation-badge {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 2px 8px;
    border-radius: 99px;
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    color: var(--accent);
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
  }

  .orientation-badge.performance {
    background: color-mix(in srgb, #f59e0b 12%, transparent);
    color: #b45309;
    border-color: color-mix(in srgb, #f59e0b 30%, transparent);
  }

  .description, .motivation {
    font-size: 14px;
    line-height: 1.6;
    color: var(--text-muted);
    margin: 0;
  }

  .muted { color: var(--text-muted); font-size: 14px; }
</style>
