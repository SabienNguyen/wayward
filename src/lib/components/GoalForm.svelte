<script lang="ts">
  import { validateGoalForm } from '$lib/validation';
  import type { GoalFormData } from '$lib/types';

  let { onsubmit }: {
    onsubmit: (data: GoalFormData & { orientation: 'performance' | 'learning' }) => void;
  } = $props();

  let name = $state('');
  let description = $state('');
  let motivation = $state('');
  let orientation = $state<'performance' | 'learning' | ''>('');
  let error = $state<string | null>(null);

  function handleSubmit() {
    const data: GoalFormData = { name, description, motivation, orientation };
    const err = validateGoalForm(data);
    if (err) { error = err; return; }
    error = null;
    onsubmit(data as GoalFormData & { orientation: 'performance' | 'learning' });
  }
</script>

<form class="goal-form" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
  <div class="field">
    <label for="name">Goal name</label>
    <input id="name" bind:value={name} placeholder="What do you want to achieve?" />
  </div>

  <div class="field">
    <label for="description">Description</label>
    <textarea id="description" bind:value={description} rows="3"
      placeholder="What does achieving this look like?"></textarea>
  </div>

  <div class="field">
    <label for="motivation">Motivation</label>
    <textarea id="motivation" bind:value={motivation} rows="2"
      placeholder="Why does this matter to you?"></textarea>
  </div>

  <div class="field">
    <label>Orientation</label>
    <div class="orientation-options">
      <label class="radio-label" class:selected={orientation === 'learning'}>
        <input type="radio" bind:group={orientation} value="learning" />
        <span>
          <strong>Learning</strong>
          <span class="radio-hint">Improve, discover, master</span>
        </span>
      </label>
      <label class="radio-label" class:selected={orientation === 'performance'}>
        <input type="radio" bind:group={orientation} value="performance" />
        <span>
          <strong>Performance</strong>
          <span class="radio-hint">Prove it, hit a benchmark</span>
        </span>
      </label>
    </div>
  </div>

  {#if error}
    <p class="error">{error}</p>
  {/if}

  <button type="submit" class="btn-primary">Save Goal</button>
</form>

<style>
  .goal-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  input, textarea {
    padding: 9px 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
    font-size: 14px;
    line-height: 1.5;
  }

  .orientation-options {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .radio-label {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    font-size: 14px;
    font-weight: normal;
    text-transform: none;
    letter-spacing: normal;
    color: var(--text);
    transition: border-color 0.15s ease;
  }

  .radio-label.selected {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 5%, transparent);
  }

  .radio-hint {
    display: block;
    font-size: 12px;
    color: var(--text-muted);
    font-weight: normal;
  }

  .error {
    font-size: 13px;
    color: var(--error, #e05);
  }

  .btn-primary {
    padding: 10px;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: var(--radius);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
</style>
