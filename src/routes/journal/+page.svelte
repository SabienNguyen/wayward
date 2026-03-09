<script lang="ts">
  import { onMount } from 'svelte';
  import { currentDateEntries, loadEntriesForDate } from '$lib/stores/journal';
  import JournalEntryForm from '$lib/components/JournalEntryForm.svelte';

  const today = new Date().toISOString().split('T')[0];
  onMount(() => loadEntriesForDate(today));
</script>

<main>
  <h2>{today}</h2>
  <JournalEntryForm />

  <div>
    {#each $currentDateEntries as entry (entry.id)}
      <div class:locked={entry.locked}>
        <time>{new Date(entry.created_at).toLocaleTimeString()}</time>
        <p>{entry.content}</p>
        {#if entry.locked}
          <span>Locked</span>
        {/if}
      </div>
    {/each}
  </div>
</main>
