<script lang="ts">
  import type { Goal } from '$lib/types';

  let { goal, onclick }: { goal: Goal; onclick: () => void } = $props();
</script>

<button
  class="w-full text-left py-5 border-b border-base-content/10 group transition-all duration-200
         hover:border-base-content/25 focus:outline-none"
  {onclick}
>
  <div class="flex items-baseline justify-between gap-4">
    <span class="font-['Cormorant'] text-2xl font-light text-base-content group-hover:text-primary
                 transition-colors duration-200 leading-tight">
      {goal.name}
    </span>
    <span class="font-['Crimson_Pro'] text-xs tracking-[0.12em] uppercase text-base-content/30
                 group-hover:text-base-content/50 transition-colors shrink-0">
      {goal.orientation}
    </span>
  </div>
  {#if goal.description}
    <p class="font-['Crimson_Pro'] italic text-sm text-base-content/35 mt-1 leading-relaxed
              group-hover:text-base-content/50 transition-colors">
      {goal.description}
    </p>
  {/if}
</button>
