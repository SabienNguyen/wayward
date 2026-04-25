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

<section class="session-log">
  <h3>Session Log</h3>

  <form class="session-form" onsubmit={(e) => { e.preventDefault(); handleAdd(); }}>
    <textarea bind:value={content} {placeholder} rows="3"></textarea>
    <div class="form-footer">
      <button type="submit" class="btn-primary">Log Session</button>
    </div>
  </form>

  <div class="sessions">
    {#each sessions as s (s.id)}
      <div class="session-entry">
        <time class="session-time">
          {new Date(s.logged_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
        </time>
        <p class="session-content">{s.content}</p>
      </div>
    {:else}
      <p class="empty">No sessions logged yet.</p>
    {/each}
  </div>
</section>

<style>
  .session-log {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  h3 {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin: 0;
  }

  .session-form {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    box-shadow: var(--shadow);
  }

  .session-form textarea {
    width: 100%;
    padding: 12px 14px;
    border: none;
    background: var(--surface);
    color: var(--text);
    font-size: 14px;
    line-height: 1.6;
    resize: vertical;
    min-height: 80px;
    box-sizing: border-box;
  }

  .form-footer {
    display: flex;
    justify-content: flex-end;
    padding: 8px 12px;
    border-top: 1px solid var(--border);
    background: var(--surface-2);
  }

  .btn-primary {
    padding: 8px 16px;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: var(--radius);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .sessions {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .session-entry {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 12px 14px;
    box-shadow: var(--shadow);
  }

  .session-time {
    display: block;
    font-size: 11px;
    color: var(--text-muted);
    margin-bottom: 6px;
    font-variant-numeric: tabular-nums;
  }

  .session-content {
    font-size: 14px;
    line-height: 1.6;
    color: var(--text);
    white-space: pre-wrap;
    margin: 0;
  }

  .empty {
    color: var(--text-muted);
    font-size: 14px;
  }
</style>
