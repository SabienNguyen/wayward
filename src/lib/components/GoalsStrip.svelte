<script lang="ts">
  import { onMount } from 'svelte';
  import { goals, loadGoals, addGoal } from '$lib/stores/goals';

  let showForm = false;
  let newGoalName = '';

  onMount(loadGoals);

  async function handleAdd() {
    if (!newGoalName.trim()) return;
    await addGoal(newGoalName.trim());
    newGoalName = '';
    showForm = false;
  }
</script>

<div class="goals-strip">
  <span class="goals-label">Goals</span>

  {#each $goals as goal (goal.id)}
    <span class="goal-pill">{goal.name}</span>
  {/each}

  {#if $goals.length < 3}
    {#if showForm}
      <form class="goal-form" on:submit|preventDefault={handleAdd}>
        <input
          class="goal-input"
          bind:value={newGoalName}
          placeholder="New goal..."
        />
        <button type="submit" class="btn-primary goal-submit">Add</button>
        <button type="button" class="btn-ghost" on:click={() => { showForm = false; newGoalName = ''; }}>
          ✕
        </button>
      </form>
    {:else}
      <button class="add-goal-btn btn-ghost" on:click={() => (showForm = true)}>
        + goal
      </button>
    {/if}
  {/if}
</div>

<style>
  .goals-strip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 20px;
    height: 40px;
    overflow-x: auto;
  }

  .goals-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
    flex-shrink: 0;
    margin-right: 4px;
  }

  .goal-pill {
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    font-size: 13px;
    font-weight: 500;
    padding: 3px 12px;
    border-radius: 99px;
    white-space: nowrap;
    box-shadow: var(--shadow);
  }

  .add-goal-btn {
    font-size: 13px;
    color: var(--accent);
    padding: 3px 10px;
    border-radius: 99px;
    border: 1px dashed var(--accent);
  }

  .add-goal-btn:hover {
    background: color-mix(in srgb, var(--accent) 10%, transparent);
  }

  .goal-form {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .goal-input {
    padding: 3px 10px;
    height: 28px;
    font-size: 13px;
    border-radius: 99px;
    width: 160px;
  }

  .goal-submit {
    font-size: 13px;
    padding: 3px 12px;
  }
</style>
