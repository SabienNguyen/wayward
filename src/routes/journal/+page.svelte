<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { currentDateEntries, loadEntriesForDate } from '$lib/stores/journal';
  import {
    isJournalLocked,
    setupJournalPassword,
    unlockJournal,
    lockJournal,
    recoverJournal,
  } from '$lib/stores/journal';
  import JournalEntryForm from '$lib/components/JournalEntryForm.svelte';

  type View = 'loading' | 'setup' | 'locked' | 'recover' | 'unlocked';

  let view: View = 'loading';
  const today = new Date().toISOString().split('T')[0];

  // Setup form
  let setupPassword = '';
  let setupConfirm = '';
  let setupPin = '';
  let setupError = '';

  // Unlock form
  let unlockPassword = '';
  let unlockError = '';

  // Recover form
  let recoverPin = '';
  let recoverNewPassword = '';
  let recoverError = '';

  onMount(async () => {
    const locked = await isJournalLocked();
    view = locked ? 'locked' : 'setup';
  });

  onDestroy(async () => {
    await lockJournal();
  });

  async function handleSetup() {
    setupError = '';
    if (setupPassword !== setupConfirm) {
      setupError = 'Passwords do not match';
      return;
    }
    if (!/^\d+$/.test(setupPin)) {
      setupError = 'PIN must be numbers only';
      return;
    }
    try {
      await setupJournalPassword(setupPassword, setupPin);
      view = 'unlocked';
      await loadEntriesForDate(today);
    } catch (e) {
      setupError = 'Failed to set up lock. Try again.';
    }
  }

  async function handleUnlock() {
    unlockError = '';
    try {
      const ok = await unlockJournal(unlockPassword);
      if (ok) {
        view = 'unlocked';
        await loadEntriesForDate(today);
      } else {
        unlockError = 'Incorrect password';
      }
    } catch (e) {
      unlockError = 'Something went wrong. Try again.';
    }
  }

  async function handleRecover() {
    recoverError = '';
    try {
      const ok = await recoverJournal(recoverPin, recoverNewPassword);
      if (ok) {
        view = 'unlocked';
        await loadEntriesForDate(today);
      } else {
        recoverError = 'Incorrect PIN';
      }
    } catch (e) {
      recoverError = 'Something went wrong. Try again.';
    }
  }
</script>

{#if view === 'loading'}
  <div class="auth-container"><p class="muted">Loading...</p></div>

{:else if view === 'setup'}
  <div class="auth-container">
    <h2 class="section-heading">Protect your journal</h2>
    <p class="muted">Set a password to encrypt your entries. Add a PIN to recover access if you forget.</p>
    <form on:submit|preventDefault={handleSetup} class="auth-form">
      <input type="password" placeholder="Password" bind:value={setupPassword} />
      <input type="password" placeholder="Confirm password" bind:value={setupConfirm} />
      <input type="text" inputmode="numeric" placeholder="Recovery PIN (numbers only)" bind:value={setupPin} />
      {#if setupError}<p class="error">{setupError}</p>{/if}
      <button type="submit" class="btn-primary">Enable journal lock</button>
    </form>
  </div>

{:else if view === 'locked'}
  <div class="auth-container">
    <h2 class="section-heading">Journal locked</h2>
    <form on:submit|preventDefault={handleUnlock} class="auth-form">
      <input type="password" placeholder="Enter password" bind:value={unlockPassword} />
      {#if unlockError}<p class="error">{unlockError}</p>{/if}
      <button type="submit" class="btn-primary">Unlock</button>
    </form>
    <button class="btn-link" on:click={() => view = 'recover'}>Forgot password?</button>
  </div>

{:else if view === 'recover'}
  <div class="auth-container">
    <h2 class="section-heading">Recover access</h2>
    <form on:submit|preventDefault={handleRecover} class="auth-form">
      <input type="text" inputmode="numeric" placeholder="Recovery PIN" bind:value={recoverPin} />
      <input type="password" placeholder="New password" bind:value={recoverNewPassword} />
      {#if recoverError}<p class="error">{recoverError}</p>{/if}
      <button type="submit" class="btn-primary">Reset password</button>
    </form>
    <button class="btn-link" on:click={() => view = 'locked'}>Back</button>
  </div>

{:else}
  <div class="journal-page">
    <h2 class="section-heading">{today}</h2>
    <JournalEntryForm />
    <div class="entries">
      {#each $currentDateEntries as entry (entry.id)}
        <div class="entry-card" class:locked={entry.locked}>
          <div class="entry-header">
            <time class="entry-time">
              {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </time>
            {#if entry.locked}
              <span class="locked-badge">Locked</span>
            {/if}
          </div>
          <p class="entry-content">{entry.content}</p>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .auth-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 48px;
    gap: 12px;
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    max-width: 320px;
  }

  .auth-form input {
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
    font-size: 14px;
  }

  .btn-primary {
    padding: 10px;
    background: var(--accent);
    color: var(--accent-text, white);
    border: none;
    border-radius: var(--radius);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-link {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 13px;
    cursor: pointer;
    text-decoration: underline;
    margin-top: 4px;
  }

  .error {
    font-size: 13px;
    color: var(--error, #e05);
  }

  .muted {
    color: var(--text-muted);
    font-size: 14px;
  }

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
