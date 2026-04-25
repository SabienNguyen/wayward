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

<section class="flex flex-col gap-2 mb-8">
  <div class="flex items-center justify-between mb-1">
    <span class="text-xs font-bold uppercase tracking-widest text-base-content/40">Milestones</span>
    {#if milestones.length > 0}
      <span class="text-xs text-base-content/40">{completed}/{milestones.length} done</span>
    {/if}
  </div>

  {#each milestones as m (m.id)}
    <label class="flex items-center gap-3 p-3 bg-base-100 border border-base-300 rounded-lg
                  cursor-pointer {m.completed ? 'opacity-50' : ''}">
      <input
        type="checkbox"
        class="checkbox checkbox-sm"
        checked={m.completed}
        onchange={(e) => ontoggle(m.id, e.currentTarget.checked)}
      />
      <span class="text-sm {m.completed ? 'line-through text-base-content/40' : ''}">{m.name}</span>
    </label>
  {/each}

  <form class="flex gap-2 mt-1" onsubmit={(e) => { e.preventDefault(); handleAdd(); }}>
    <input class="input input-bordered input-sm flex-1" bind:value={newName}
      placeholder="Add a milestone..." />
    <button type="submit" class="btn btn-ghost btn-sm">Add</button>
  </form>
</section>
