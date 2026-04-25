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

<form class="flex flex-col gap-5" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
  <label class="form-control w-full">
    <div class="label pb-1"><span class="label-text font-semibold">Goal name</span></div>
    <input class="input input-bordered w-full" bind:value={name}
      placeholder="What do you want to achieve?" />
  </label>

  <label class="form-control w-full">
    <div class="label pb-1"><span class="label-text font-semibold">Description</span></div>
    <textarea class="textarea textarea-bordered w-full" bind:value={description} rows="3"
      placeholder="What does achieving this look like?"></textarea>
  </label>

  <label class="form-control w-full">
    <div class="label pb-1"><span class="label-text font-semibold">Motivation</span></div>
    <textarea class="textarea textarea-bordered w-full" bind:value={motivation} rows="2"
      placeholder="Why does this matter to you?"></textarea>
  </label>

  <fieldset class="flex flex-col gap-2">
    <legend class="label-text font-semibold mb-1">Orientation</legend>
    <label class="flex items-center gap-3 p-3 border border-base-300 rounded-lg cursor-pointer
                  transition-colors {orientation === 'learning' ? 'border-base-content bg-base-200' : ''}">
      <input type="radio" class="radio radio-sm" bind:group={orientation} value="learning" />
      <span class="flex flex-col">
        <span class="font-semibold text-sm">Learning</span>
        <span class="text-xs text-base-content/50">Improve, discover, master</span>
      </span>
    </label>
    <label class="flex items-center gap-3 p-3 border border-base-300 rounded-lg cursor-pointer
                  transition-colors {orientation === 'performance' ? 'border-base-content bg-base-200' : ''}">
      <input type="radio" class="radio radio-sm" bind:group={orientation} value="performance" />
      <span class="flex flex-col">
        <span class="font-semibold text-sm">Performance</span>
        <span class="text-xs text-base-content/50">Prove it, hit a benchmark</span>
      </span>
    </label>
  </fieldset>

  {#if error}
    <p class="text-error text-sm">{error}</p>
  {/if}

  <button type="submit" class="btn btn-primary w-full">Save Goal</button>
</form>
