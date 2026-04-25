<script lang="ts">
  import type { Goal } from '$lib/types';

  let { goal, onclick }: { goal: Goal; onclick: () => void } = $props();
</script>

<div
  class="card card-compact bg-base-100 border border-base-300 shadow-sm cursor-pointer
         hover:shadow-md hover:border-base-content/30 transition-all duration-150"
  role="button"
  tabindex="0"
  {onclick}
  onkeydown={(e) => e.key === 'Enter' && onclick()}
>
  <div class="card-body gap-2">
    <div class="flex items-center justify-between gap-3">
      <span class="font-semibold text-sm">{goal.name}</span>
      <div class="badge badge-outline badge-sm shrink-0
                  {goal.orientation === 'performance' ? 'badge-warning' : ''}">
        {goal.orientation}
      </div>
    </div>
    {#if goal.description}
      <p class="text-xs text-base-content/50 leading-relaxed">{goal.description}</p>
    {/if}
  </div>
</div>
