<script lang="ts">
  import { onMount } from 'svelte';
  import { goals, loadGoals, addGoal } from '$lib/stores/goals';

  onMount(loadGoals);
  let name = '';

  async function handleSubmit() {
    if (!name.trim()) return;
    await addGoal(name.trim());
    name = '';
  }
</script>

<main>
  <h2>Goals</h2>
  <p>Up to 3 goals, locked for one year.</p>

  {#each $goals as goal (goal.id)}
    <div>
      <span>{goal.name}</span>
      <small>until {goal.locked_until}</small>
    </div>
  {/each}

  {#if $goals.length < 3}
    <form on:submit|preventDefault={handleSubmit}>
      <input bind:value={name} placeholder="Add a goal..." />
      <button type="submit">Add</button>
    </form>
  {/if}
</main>
