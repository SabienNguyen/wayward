<script lang="ts">
  import { addTask } from '$lib/stores/tasks';

  export let quadrant: number;
  let name = '';

  async function handleSubmit() {
    if (!name.trim()) return;
    await addTask(name.trim(), quadrant);
    name = '';
  }
</script>

<form class="add-task-form" on:submit|preventDefault={handleSubmit}>
  <input class="task-input" bind:value={name} placeholder="Add task..." />
  <button type="submit" class="btn-primary">Add</button>
</form>

<style>
  .add-task-form {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  .task-input {
    flex: 1;
    padding: 7px 12px;
    border-radius: var(--radius-sm);
  }
</style>
