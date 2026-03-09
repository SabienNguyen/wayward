<script lang="ts">
  import { addEntry } from '$lib/stores/journal';

  let content = '';

  async function handleSubmit() {
    if (!content.trim()) return;
    await addEntry(content.trim());
    content = '';
  }
</script>

<form class="journal-form" on:submit|preventDefault={handleSubmit}>
  <textarea
    class="journal-textarea"
    bind:value={content}
    placeholder="Write a thought..."
    rows="3"
  ></textarea>
  <div class="journal-form-footer">
    <button type="submit" class="btn-primary">Add Entry</button>
  </div>
</form>

<style>
  .journal-form {
    margin-bottom: 20px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    overflow: hidden;
  }

  .journal-textarea {
    width: 100%;
    padding: 12px 14px;
    border: none;
    border-radius: 0;
    resize: vertical;
    min-height: 80px;
    background: var(--surface);
    font-size: 14px;
    line-height: 1.6;
  }

  .journal-form-footer {
    display: flex;
    justify-content: flex-end;
    padding: 8px 12px;
    border-top: 1px solid var(--border);
    background: var(--surface-2);
  }
</style>
