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

<section class="flex flex-col gap-6">
  <span class="section-label">Session Log</span>

  <form class="flex flex-col gap-3" onsubmit={(e) => { e.preventDefault(); handleAdd(); }}>
    <textarea
      class="lined-textarea"
      bind:value={content}
      {placeholder}
      rows="4"
    ></textarea>
    <div class="flex justify-end">
      <button type="submit"
        class="font-['Crimson_Pro'] text-xs tracking-widest uppercase text-base-content/35
               border border-base-content/15 px-5 py-2
               hover:border-base-content/40 hover:text-base-content/70
               transition-all duration-200">
        record
      </button>
    </div>
  </form>

  <div class="flex flex-col gap-5">
    {#each sessions as s (s.id)}
      <div class="session-entry animate-fade-up">
        <time class="font-['Crimson_Pro'] text-xs tracking-widest uppercase text-base-content/25 block mb-2">
          {new Date(s.logged_at).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
        </time>
        <p class="font-['Courier_Prime'] text-sm leading-7 text-base-content/70 whitespace-pre-wrap">
          {s.content}
        </p>
      </div>
    {:else}
      <p class="font-['Crimson_Pro'] italic text-sm text-base-content/25">
        No sessions recorded yet.
      </p>
    {/each}
  </div>
</section>

<style>
  .section-label {
    font-family: 'Crimson Pro', serif;
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: oklch(var(--bc) / 0.35);
  }

  .lined-textarea {
    width: 100%;
    background: transparent;
    border: none;
    outline: none;
    resize: none;
    font-family: 'Courier Prime', 'Courier New', monospace;
    font-size: 14px;
    color: oklch(var(--bc) / 0.75);
    line-height: 28px;
    padding: 0;
    background-image: repeating-linear-gradient(
      to bottom,
      transparent,
      transparent 27px,
      oklch(var(--bc) / 0.08) 27px,
      oklch(var(--bc) / 0.08) 28px
    );
  }

  .lined-textarea::placeholder {
    color: oklch(var(--bc) / 0.2);
    font-style: italic;
  }

  .session-entry {
    padding-bottom: 20px;
    border-bottom: 1px solid oklch(var(--bc) / 0.08);
  }

  .session-entry:last-child {
    border-bottom: none;
  }
</style>
