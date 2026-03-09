# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Vision

**Wayward** is a productivity hub built around the Eisenhower Matrix. The core insight: most tools fail because they mix urgent/important tasks with "someday" aspirations. Wayward separates these intentionally.

Key modes:
- **Do mode** — Q1 (urgent+important) and Q2 (not urgent, important) task lists. Q2 has no due dates — the app motivates through visibility, not deadlines.
- **Journal mode** — multiple dated entries per day, ordered by creation time, immutable after 11:59 PM
- **Goals** — up to 3 goals locked for one year from creation

## Tech Stack

Tauri v2 desktop + mobile app (Win/Mac/Linux/iOS/Android):

**Rust core** (`src-tauri/`)
- Business logic in `src-tauri/src/` — `tasks.rs`, `journal.rs`, `goals.rs`
- Tauri IPC commands in `src-tauri/src/commands/`
- SQLite via `sqlx` with migrations in `src-tauri/migrations/`
- LAN sync: `src-tauri/src/sync/` (mDNS discovery + TCP server)
- Midnight journal locking: `src-tauri/src/lock_scheduler.rs`

**Svelte frontend** (`src/`)
- SvelteKit with static adapter
- Stores in `src/lib/stores/` — call Rust via `invoke()` and re-fetch after mutations
- Routes: `/do`, `/journal`, `/goals`

## Commands

**Dev (opens native window):**
```bash
npm install
npm run tauri dev
```

**Run Rust tests only (no window needed):**
```bash
cd src-tauri && cargo test
```

**Production build:**
```bash
npm run tauri build
# Output: src-tauri/target/release/bundle/
```

**TypeScript check:**
```bash
npm run check
```

**Mobile (requires Android SDK / Xcode):**
```bash
npm run tauri android dev
npm run tauri ios dev     # macOS only
```

## Architecture Notes

- **No HTTP server** — frontend calls Rust directly via Tauri IPC (`invoke()`), not REST
- **Local-first** — all data in SQLite at the OS app data dir (`wayward.db`); no cloud dependency
- **Sync** — devices sync over LAN via mDNS (`_wayward._tcp.local.`) + direct TCP on port `47832`; last-write-wins on `updated_at`; soft deletes propagate via `deleted_at` tombstones
- **Quadrant constraint** — `tasks` table enforces `CHECK (quadrant IN (1, 2))`; Q3/Q4 are intentionally excluded from the data model
- **Journal locking** — `lock_scheduler.rs` sleeps until midnight then sets `locked=1` on the previous day's entries; locked entries cannot be edited
- Keep Tauri commands thin — business logic lives in the module files, commands just pull `AppState` and delegate
