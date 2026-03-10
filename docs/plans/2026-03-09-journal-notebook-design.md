# Journal Notebook Layout Design

**Date:** 2026-03-09

## Goal

Redesign the unlocked journal view into a two-panel notebook interface: a scrollable date sidebar on the left and a ruled notebook page on the right.

## Layout

Two-panel horizontal split within the unlocked view only. Auth views (loading, setup, locked, recover) are unchanged.

- **Left panel:** `~200px` fixed width, scrollable
- **Right panel:** flex-grow, full height

Today's date is auto-selected when the journal unlocks.

## Left Panel — Date Sidebar

- Lists all dates that have journal entries, sorted newest-first
- Format: `MM/DD/YYYY`
- Clickable rows; selected date highlighted
- New Rust command: `cmd_list_journal_dates`
  - Query: `SELECT DISTINCT date FROM journal_entries WHERE deleted_at IS NULL ORDER BY date DESC`
  - Returns: `Vec<String>`
- Sidebar loads on unlock, refreshes after each new entry is saved

## Right Panel — Notebook Interface

- Warm off-white background (`#faf9f6`), subtle drop shadow
- Horizontal ruled lines via `repeating-linear-gradient` matching text line height
- Entries flow top-to-bottom with a small timestamp in the margin
- New entry textarea at the bottom, borderless — blends into the ruled lines
- Submit via button or `Ctrl+Enter`
- If selected date is in the past and locked, the textarea is hidden

## Data Model Change

One new Rust command added to `src-tauri/src/commands/journal.rs`:

```rust
#[tauri::command]
pub async fn cmd_list_journal_dates(state: State<'_, AppState>) -> Result<Vec<String>, String>
```

Registered in `src-tauri/src/lib.rs` invoke handler.

New frontend store function in `src/lib/stores/journal.ts`:

```typescript
export async function listJournalDates(): Promise<string[]>
```

## Files Changed

- `src-tauri/src/commands/journal.rs` — add `cmd_list_journal_dates`
- `src-tauri/src/lib.rs` — register new command
- `src/lib/stores/journal.ts` — add `listJournalDates`
- `src/routes/journal/+page.svelte` — full redesign of unlocked view
