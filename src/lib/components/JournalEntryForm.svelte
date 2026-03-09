<script lang="ts">
  import { addEntry } from '$lib/stores/journal';

  let content = '';

  async function handleSubmit() {
    if (!content.trim()) return;
    await addEntry(content.trim());
    content = '';
  }
</script>

<form on:submit|preventDefault={handleSubmit}>
  <textarea bind:value={content} placeholder="Write a thought..." rows="3"></textarea>
  <button type="submit">Add Entry</button>
</form>
