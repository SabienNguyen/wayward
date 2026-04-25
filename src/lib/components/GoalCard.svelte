<script lang="ts">
  import type { Goal } from '$lib/types';

  let { goal, onclick }: { goal: Goal; onclick: () => void } = $props();
</script>

<div
  class="goal-card"
  role="button"
  tabindex="0"
  {onclick}
  onkeydown={(e) => e.key === 'Enter' && onclick()}
>
  <div class="card-header">
    <span class="goal-name">{goal.name}</span>
    <span class="orientation-badge" class:performance={goal.orientation === 'performance'}>
      {goal.orientation}
    </span>
  </div>
  {#if goal.description}
    <p class="goal-description">{goal.description}</p>
  {/if}
</div>

<style>
  .goal-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px;
    cursor: pointer;
    box-shadow: var(--shadow);
    transition: box-shadow 0.15s ease, border-color 0.15s ease;
  }

  .goal-card:hover {
    box-shadow: var(--shadow-md);
    border-color: var(--accent);
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .goal-name {
    font-size: 15px;
    font-weight: 600;
    color: var(--text);
  }

  .orientation-badge {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 2px 8px;
    border-radius: 99px;
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    color: var(--accent);
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
    flex-shrink: 0;
  }

  .orientation-badge.performance {
    background: color-mix(in srgb, #f59e0b 12%, transparent);
    color: #b45309;
    border-color: color-mix(in srgb, #f59e0b 30%, transparent);
  }

  .goal-description {
    margin-top: 8px;
    font-size: 13px;
    color: var(--text-muted);
    line-height: 1.5;
    white-space: pre-wrap;
  }
</style>
