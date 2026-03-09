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

<form on:submit|preventDefault={handleSubmit}>
  <input bind:value={name} placeholder="Add task..." />
  <button type="submit">Add</button>
</form>
