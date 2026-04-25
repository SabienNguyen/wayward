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

<section>
  <div class="flex items-baseline justify-between mb-4">
    <span class="section-label">Milestones</span>
    {#if milestones.length > 0}
      <span class="font-['Crimson_Pro'] text-xs text-base-content/30 tracking-wide">
        {completed} of {milestones.length}
      </span>
    {/if}
  </div>

  <div class="flex flex-col">
    {#each milestones as m (m.id)}
      <label class="milestone-row {m.completed ? 'is-done' : ''}">
        <button
          class="milestone-check"
          onclick={() => ontoggle(m.id, !m.completed)}
          aria-label={m.completed ? 'Mark incomplete' : 'Mark complete'}
          type="button"
        >
          {m.completed ? '◆' : '◇'}
        </button>
        <span class="font-['Crimson_Pro'] text-base leading-relaxed">{m.name}</span>
      </label>
    {/each}
  </div>

  <form class="flex items-center gap-3 mt-3 pt-3 border-t border-base-content/10"
    onsubmit={(e) => { e.preventDefault(); handleAdd(); }}>
    <input
      class="flex-1 bg-transparent border-none outline-none font-['Crimson_Pro'] text-base
             text-base-content/70 placeholder:text-base-content/20 placeholder:italic"
      bind:value={newName}
      placeholder="add a milestone..."
    />
    <button type="submit"
      class="font-['Crimson_Pro'] text-xs tracking-widest uppercase text-base-content/30
             hover:text-base-content/60 transition-colors">
      add
    </button>
  </form>
</section>

<style>
  .section-label {
    font-family: 'Crimson Pro', serif;
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: oklch(var(--bc) / 0.35);
  }

  .milestone-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px solid oklch(var(--bc) / 0.07);
    cursor: pointer;
    transition: opacity 0.2s;
  }

  .milestone-row.is-done {
    opacity: 0.35;
    text-decoration: line-through;
  }

  .milestone-check {
    font-size: 13px;
    color: oklch(var(--p));
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    line-height: 1;
    flex-shrink: 0;
  }
</style>
