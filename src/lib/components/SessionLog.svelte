<script lang="ts">
  import type { Session } from '$lib/types';

  let { sessions, orientation, onadd }: {
    sessions: Session[];
    orientation: 'performance' | 'learning';
    onadd: (content: string) => void;
  } = $props();

  const placeholder = $derived(
    orientation === 'performance'
      ? 'How did you benchmark? What did you hit?'
      : 'What did you discover? What improved?'
  );

  let content = $state('');

  function handleAdd() {
    if (!content.trim()) return;
    onadd(content.trim());
    content = '';
  }
</script>

<section class="flex flex-col gap-3">
  <span class="text-xs font-bold uppercase tracking-widest text-base-content/40">Session Log</span>

  <form class="flex flex-col border border-base-300 rounded-lg overflow-hidden bg-base-100"
    onsubmit={(e) => { e.preventDefault(); handleAdd(); }}>
    <textarea class="textarea border-none rounded-none resize-none bg-base-100 focus:outline-none"
      bind:value={content} {placeholder} rows="3"></textarea>
    <div class="flex justify-end p-2 border-t border-base-300 bg-base-200">
      <button type="submit" class="btn btn-primary btn-sm">Log Session</button>
    </div>
  </form>

  <div class="flex flex-col gap-2">
    {#each sessions as s (s.id)}
      <div class="card card-compact bg-base-100 border border-base-300 shadow-sm">
        <div class="card-body gap-1">
          <time class="text-xs text-base-content/40 tabular-nums">
            {new Date(s.logged_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
          </time>
          <p class="text-sm leading-relaxed whitespace-pre-wrap">{s.content}</p>
        </div>
      </div>
    {:else}
      <p class="text-sm text-base-content/40">No sessions logged yet.</p>
    {/each}
  </div>
</section>
