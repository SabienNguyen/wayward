<script lang="ts">
  import type { Milestone } from '$lib/types';

  let { milestones, onadd, ontoggle }: {
    milestones: Milestone[];
    onadd: (name: string) => void;
    ontoggle: (id: string, completed: boolean) => void;
  } = $props();

  let newName = $state('');

  const completed = $derived(milestones.filter(m => m.completed).length);

  function handleAdd() {
    if (!newName.trim()) return;
    onadd(newName.trim());
    newName = '';
  }
</script>

<section class="milestones">
  <div class="section-header">
    <h3>Milestones</h3>
    {#if milestones.length > 0}
      <span class="progress">{completed}/{milestones.length} done</span>
    {/if}
  </div>

  {#each milestones as m (m.id)}
    <label class="milestone-item" class:done={m.completed}>
      <input
        type="checkbox"
        checked={m.completed}
        onchange={(e) => ontoggle(m.id, e.currentTarget.checked)}
      />
      <span class="milestone-name">{m.name}</span>
    </label>
  {/each}

  <form class="add-form" onsubmit={(e) => { e.preventDefault(); handleAdd(); }}>
    <input bind:value={newName} placeholder="Add a milestone..." />
    <button type="submit" class="btn-ghost">Add</button>
  </form>
</section>

<style>
  .milestones {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 32px;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  h3 {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin: 0;
  }

  .progress {
    font-size: 12px;
    color: var(--text-muted);
  }

  .milestone-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    font-size: 14px;
    color: var(--text);
    font-weight: normal;
    text-transform: none;
    letter-spacing: normal;
  }

  .milestone-item.done .milestone-name {
    text-decoration: line-through;
    color: var(--text-muted);
  }

  .add-form {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }

  .add-form input {
    flex: 1;
    padding: 7px 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
    font-size: 14px;
  }

  .btn-ghost {
    padding: 7px 14px;
    border-radius: var(--radius);
    font-size: 14px;
    color: var(--text-muted);
    background: transparent;
    border: 1px solid var(--border);
    cursor: pointer;
  }
</style>
