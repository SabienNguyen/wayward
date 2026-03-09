# Wayward — Architecture Design

**Date:** 2026-03-08

## Vision

A productivity hub built around the Eisenhower Matrix. The core problem with existing tools: they mix urgent tasks with aspirational ones, creating an impossible backlog. Wayward separates these intentionally — and for Q2 (the tasks that actually matter), the app's job is to keep them visible and motivate progress, not to schedule or pressure.

## Target Platforms

- Desktop: Windows, macOS, Linux (Tauri v2)
- Mobile: iOS, Android (Tauri v2 mobile)

No web version. No paid services. No cloud storage.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| App shell | Tauri v2 |
| Frontend | Svelte |
| Core logic | Rust |
| Local storage | SQLite via sqlx |
| Device discovery | mdns-sd crate |
| Async runtime | tokio |
| External services | None |

## Architecture

```
Tauri v2 shell
├── Svelte UI
│   ├── Do mode (Q1 + Q2 task views)
│   ├── Journal mode (dated entries)
│   └── Goals view
├── Rust core (src-tauri/)
│   ├── commands/     — Tauri IPC handlers
│   ├── db/           — SQLite layer + migrations
│   └── sync/         — mDNS discovery + sync protocol
└── SQLite (per device)
```

**Data flow:** Svelte calls `invoke()` → Rust command → SQLite → serialized response back to Svelte. No HTTP, no REST API — direct IPC between the WebView and the Rust process.

## Project Structure

```
wayward/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands/
│   │   │   ├── tasks.rs
│   │   │   ├── journal.rs
│   │   │   └── sync.rs
│   │   ├── db/
│   │   │   └── migrations/
│   │   └── sync/
│   └── Cargo.toml
└── src/
    ├── lib/
    │   ├── components/
    │   └── stores/
    └── routes/
```

## Data Model

```sql
-- Tasks (Do mode)
tasks
  id          TEXT PRIMARY KEY   -- UUID
  name        TEXT NOT NULL
  quadrant    INTEGER NOT NULL   -- 1 (urgent+important) or 2 (not urgent, important)
  completed   BOOLEAN DEFAULT false
  position    INTEGER            -- manual sort order within quadrant
  device_id   TEXT NOT NULL
  updated_at  INTEGER NOT NULL   -- Unix ms, used for sync conflict resolution
  deleted_at  INTEGER            -- soft delete for sync tombstoning

-- Journal entries
journal_entries
  id          TEXT PRIMARY KEY
  content     TEXT NOT NULL
  date        TEXT NOT NULL      -- "YYYY-MM-DD" for visual grouping
  created_at  INTEGER NOT NULL   -- exact Unix ms, determines ordering
  device_id   TEXT NOT NULL
  updated_at  INTEGER NOT NULL
  locked      BOOLEAN DEFAULT false  -- true after 11:59 PM on that date
  deleted_at  INTEGER

-- Goals
goals
  id          TEXT PRIMARY KEY
  name        TEXT NOT NULL
  locked_until TEXT NOT NULL    -- "YYYY-MM-DD", one year from creation
  device_id   TEXT NOT NULL
  updated_at  INTEGER NOT NULL
```

**Design decisions:**
- Soft deletes via `deleted_at` — required for sync to propagate deletions across devices
- No Q3/Q4 tasks — the UI makes no affordance for them; the constraint is intentional
- Q2 tasks have no temporal metadata (no due dates, no scheduling fields) — the philosophy is commitment, not scheduling
- Journal entries lock at midnight; a Rust background task sets `locked = true` on the day's entries at 11:59 PM

## Modes

### Do Mode

Two quadrant views:
- **Q1 — Urgent & Important:** Tasks to act on now
- **Q2 — Not Urgent, Important:** The things that actually matter

Q2 philosophy: the app does not ask users to schedule these tasks. There is no due date, no "overdue" state, no time estimate. Seeing Q2 tasks daily — prominently — is the mechanism. The process motivates, not the deadline. Completing a Q2 task should feel meaningful in the UI, not routine.

Tasks are manually ordered within each quadrant via drag-and-drop (`position` field).

### Journal Mode

- Multiple entries per day, each with an exact `created_at` timestamp
- Entries from all paired devices are merged and displayed in chronological order by `created_at`
- Entries are immutable after 11:59 PM on their `date`
- No editing yesterday's entries — the journal is a record, not a draft

### Goals

- Max 3 goals at a time
- Each goal is locked for one year from creation — cannot be deleted or changed during that period
- Forces intentionality: you must commit before you can track

## Sync Protocol

**No cloud relay.** Devices sync directly over LAN using mDNS for discovery.

### Pairing

1. First time, Device A displays a QR code (or short numeric code) containing its local IP + a pairing token
2. Device B scans/enters the code, connects directly, and both devices store each other's UUIDs
3. Pairing is permanent — no re-pairing needed

### Sync Flow

```
Device A                              Device B
  |── mDNS broadcast ──────────────────────►|
  |◄─────────────────── mDNS response ──────|
  |── TCP connect ─────────────────────────►|
  |── send diff (records where              |
  |   updated_at > last_synced_at) ────────►|
  |◄──────────── send diff (B's changes) ───|
  | apply: last-write-wins on updated_at    |
  | update last_synced_at per peer device   |
```

**Conflict resolution:** Last-write-wins per record based on `updated_at`. Acceptable for a personal app where one person owns all devices.

**Journal sync:** Entries are effectively append-only once locked. The only conflict window is an unlocked entry edited on two devices before sync — last-write-wins applies.

**Task position conflicts:** If positions diverge across devices, they reconcile on next sync. Minor inconsistencies are acceptable — position is cosmetic.

**Offline:** Each device operates fully independently when not on the same network. No data loss. Sync resumes automatically next time devices are discovered via mDNS.
