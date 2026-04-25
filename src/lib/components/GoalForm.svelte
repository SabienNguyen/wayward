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

<form class="flex flex-col gap-8" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>

  <div class="field-group">
    <label class="field-label" for="name">the goal</label>
    <input
      id="name"
      class="field-input text-2xl font-['Cormorant'] font-light"
      bind:value={name}
      placeholder="What do you want to achieve?"
      autocomplete="off"
    />
  </div>

  <div class="field-group">
    <label class="field-label" for="description">what it looks like</label>
    <textarea
      id="description"
      class="field-input field-textarea font-['Crimson_Pro']"
      bind:value={description}
      rows="3"
      placeholder="Describe what achieving this actually looks like..."
    ></textarea>
  </div>

  <div class="field-group">
    <label class="field-label" for="motivation">why it matters</label>
    <textarea
      id="motivation"
      class="field-input field-textarea font-['Crimson_Pro'] italic"
      bind:value={motivation}
      rows="2"
      placeholder="What draws you to this?"
    ></textarea>
  </div>

  <fieldset class="flex flex-col gap-2">
    <legend class="field-label mb-3">orientation</legend>
    <label class="orientation-option {orientation === 'learning' ? 'is-selected' : ''}">
      <input type="radio" class="sr-only" bind:group={orientation} value="learning" />
      <div>
        <span class="font-['Cormorant'] text-lg font-light">Learning</span>
        <span class="block font-['Crimson_Pro'] italic text-sm text-base-content/35 mt-0.5">
          Improve, discover, master
        </span>
      </div>
      <span class="check-mark">{orientation === 'learning' ? '◆' : '◇'}</span>
    </label>
    <label class="orientation-option {orientation === 'performance' ? 'is-selected' : ''}">
      <input type="radio" class="sr-only" bind:group={orientation} value="performance" />
      <div>
        <span class="font-['Cormorant'] text-lg font-light">Performance</span>
        <span class="block font-['Crimson_Pro'] italic text-sm text-base-content/35 mt-0.5">
          Prove it, hit a benchmark
        </span>
      </div>
      <span class="check-mark">{orientation === 'performance' ? '◆' : '◇'}</span>
    </label>
  </fieldset>

  {#if error}
    <p class="font-['Crimson_Pro'] italic text-error/70 text-sm">{error}</p>
  {/if}

  <button
    type="submit"
    class="font-['Crimson_Pro'] tracking-widest uppercase text-sm text-base-content/50
           border border-base-content/20 py-3
           hover:border-base-content/50 hover:text-base-content/80
           transition-all duration-300 mt-2"
  >
    Save Goal
  </button>
</form>

<style>
  .field-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    border-bottom: 1px solid oklch(var(--bc) / 0.12);
    padding-bottom: 8px;
  }

  .field-label {
    font-family: 'Crimson Pro', serif;
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: oklch(var(--bc) / 0.35);
  }

  .field-input {
    background: transparent;
    border: none;
    outline: none;
    color: oklch(var(--bc) / 0.85);
    width: 100%;
    padding: 4px 0;
  }

  .field-input::placeholder {
    color: oklch(var(--bc) / 0.2);
    font-style: italic;
  }

  .field-textarea {
    resize: none;
    line-height: 1.7;
    font-size: 16px;
  }

  .orientation-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border: 1px solid oklch(var(--bc) / 0.12);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .orientation-option:hover {
    border-color: oklch(var(--bc) / 0.3);
  }

  .orientation-option.is-selected {
    border-color: oklch(var(--p));
    background: oklch(var(--p) / 0.06);
  }

  .check-mark {
    font-size: 14px;
    color: oklch(var(--p));
    transition: opacity 0.2s;
  }
</style>
