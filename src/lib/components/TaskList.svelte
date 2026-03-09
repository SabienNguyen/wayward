<script lang="ts">
  import type { Task } from '$lib/stores/tasks';
  import { completeTask, deleteTask } from '$lib/stores/tasks';

  export let tasks: Task[];
</script>

<ul>
  {#each tasks as task (task.id)}
    <li class:completed={task.completed}>
      <span>{task.name}</span>
      <div>
        {#if !task.completed}
          <button on:click={() => completeTask(task.id)}>Done</button>
        {/if}
        <button on:click={() => deleteTask(task.id)}>Delete</button>
      </div>
    </li>
  {/each}
</ul>
