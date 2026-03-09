<script lang="ts">
  import { onMount } from 'svelte';
  import { currentDateEntries, loadEntriesForDate } from '$lib/stores/journal';
  import JournalEntryForm from '$lib/components/JournalEntryForm.svelte';

  const today = new Date().toISOString().split('T')[0];
  onMount(() => loadEntriesForDate(today));
</script>

<div class="journal-page">
  <h2 class="section-heading">{today}</h2>
  <JournalEntryForm />

  <div class="entries">
    {#each $currentDateEntries as entry (entry.id)}
      <div class="entry-card" class:locked={entry.locked}>
        <div class="entry-header">
          <time class="entry-time">{new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
          {#if entry.locked}
            <span class="locked-badge">Locked</span>
          {/if}
        </div>
        <p class="entry-content">{entry.content}</p>
      </div>
    {/each}
  </div>
</div>

<style>
  .journal-page {
    display: flex;
    flex-direction: column;
    padding-top: 16px;
  }

  .entries {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .entry-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 12px 14px;
    box-shadow: var(--shadow);
  }

  .entry-card.locked {
    opacity: 0.7;
    border-style: dashed;
  }

  .entry-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .entry-time {
    font-size: 12px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }

  .locked-badge {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-muted);
    background: var(--surface-2);
    border: 1px solid var(--border);
    padding: 1px 7px;
    border-radius: 99px;
  }

  .entry-content {
    font-size: 14px;
    line-height: 1.6;
    color: var(--text);
    white-space: pre-wrap;
  }
</style>
