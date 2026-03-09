<script lang="ts">
  import { onMount } from 'svelte';
  import { q1Tasks, q2Tasks, loadTasks } from '$lib/stores/tasks';
  import TaskList from '$lib/components/TaskList.svelte';
  import AddTaskForm from '$lib/components/AddTaskForm.svelte';

  onMount(loadTasks);
</script>

<div class="do-page">
  <section class="task-section">
    <h2 class="section-heading">Urgent & Important</h2>
    <AddTaskForm quadrant={1} />
    <TaskList tasks={$q1Tasks} />
  </section>

  <section class="task-section">
    <h2 class="section-heading">What Matters</h2>
    <AddTaskForm quadrant={2} />
    <TaskList tasks={$q2Tasks} />
  </section>
</div>

<style>
  .do-page {
    display: flex;
    flex-direction: column;
    gap: 32px;
    padding-top: 16px;
  }

  .task-section {
    display: flex;
    flex-direction: column;
  }
</style>
