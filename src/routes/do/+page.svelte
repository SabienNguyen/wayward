<script lang="ts">
  import { onMount } from 'svelte';
  import { q1Tasks, q2Tasks, loadTasks } from '$lib/stores/tasks';
  import TaskList from '$lib/components/TaskList.svelte';
  import AddTaskForm from '$lib/components/AddTaskForm.svelte';

  onMount(loadTasks);
</script>

<main>
  <section>
    <h2>Urgent & Important</h2>
    <AddTaskForm quadrant={1} />
    <TaskList tasks={$q1Tasks} />
  </section>

  <section>
    <h2>What Matters</h2>
    <p>These take the time they need.</p>
    <AddTaskForm quadrant={2} />
    <TaskList tasks={$q2Tasks} />
  </section>
</main>
