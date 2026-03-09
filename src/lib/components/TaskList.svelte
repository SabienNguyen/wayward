<script lang="ts">
  import type { Task } from '$lib/stores/tasks';
  import { completeTask, deleteTask } from '$lib/stores/tasks';

  export let tasks: Task[];
</script>

<ul class="task-list">
  {#each tasks as task (task.id)}
    <li class="task-item" class:completed={task.completed}>
      <span class="task-name">{task.name}</span>
      <div class="task-actions">
        {#if !task.completed}
          <button class="action-btn done-btn" on:click={() => completeTask(task.id)} title="Complete">✓</button>
        {/if}
        <button class="action-btn delete-btn" on:click={() => deleteTask(task.id)} title="Delete">✕</button>
      </div>
    </li>
  {/each}
</ul>

<style>
  .task-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .task-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    transition: box-shadow 0.15s ease, border-color 0.15s ease;
  }

  .task-item:hover {
    box-shadow: var(--shadow-md);
    border-color: var(--accent);
  }

  .task-item.completed {
    opacity: 0.55;
  }

  .task-name {
    font-size: 14px;
    color: var(--text);
  }

  .task-item.completed .task-name {
    text-decoration: line-through;
    color: var(--text-muted);
  }

  .task-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .task-item:hover .task-actions {
    opacity: 1;
  }

  .action-btn {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-2);
    color: var(--text-muted);
    border: 1px solid var(--border);
  }

  .done-btn:hover {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }

  .delete-btn:hover {
    background: #ef4444;
    color: #fff;
    border-color: #ef4444;
  }
</style>
