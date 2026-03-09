# Wayward Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a cross-platform productivity app (desktop + mobile) with Do mode, Journal mode, Goals, and LAN sync — using Tauri v2, Svelte, Rust, and SQLite.

**Architecture:** Svelte frontend calls Rust business logic via Tauri IPC (`invoke()`). All data lives in per-device SQLite databases. Devices sync directly over LAN using mDNS discovery and a tokio TCP server — no cloud, no auth service.

**Tech Stack:** Tauri v2, Svelte 5, Rust (sqlx, tokio, mdns-sd, uuid, chrono), SQLite

---

## Task 1: Scaffold Tauri v2 + Svelte project

**Files:**
- Create: project root (scaffolded by CLI)

**Step 1: Scaffold the project**

```bash
cd /home/sabien/Dev/personal/wayward
npm create tauri-app@latest . -- --template svelte-ts --manager npm
```

When prompted: app name = `wayward`, bundle identifier = `com.wayward.app`

**Step 2: Verify it builds**

```bash
npm install
npm run tauri dev
```

Expected: Tauri window opens with default Svelte content.

**Step 3: Remove boilerplate**

Delete `src/lib/Greet.svelte` and clear `src/routes/+page.svelte` to a blank `<main></main>`.

Remove the `greet` example command from `src-tauri/src/lib.rs` and `src-tauri/src/main.rs`.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: scaffold Tauri v2 + Svelte project"
```

---

## Task 2: Add Rust dependencies

**Files:**
- Modify: `src-tauri/Cargo.toml`

**Step 1: Update Cargo.toml dependencies**

```toml
[dependencies]
tauri = { version = "2", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
sqlx = { version = "0.8", features = ["runtime-tokio", "sqlite", "migrate"] }
tokio = { version = "1", features = ["full"] }
uuid = { version = "1", features = ["v4"] }
chrono = { version = "0.4", features = ["serde"] }
mdns-sd = "0.11"
```

**Step 2: Verify it compiles**

```bash
cd src-tauri && cargo build
```

Expected: compiles without errors.

**Step 3: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "feat: add Rust dependencies"
```

---

## Task 3: Database migrations

**Files:**
- Create: `src-tauri/migrations/001_initial.sql`
- Create: `src-tauri/src/db.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: Write the migration SQL**

Create `src-tauri/migrations/001_initial.sql`:

```sql
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    quadrant INTEGER NOT NULL CHECK (quadrant IN (1, 2)),
    completed INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    device_id TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS journal_entries (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    date TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    device_id TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    locked INTEGER NOT NULL DEFAULT 0,
    deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    locked_until TEXT NOT NULL,
    device_id TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    last_synced_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

**Step 2: Write db.rs**

Create `src-tauri/src/db.rs`:

```rust
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use std::path::Path;

pub async fn init_db(db_path: &Path) -> Result<SqlitePool, sqlx::Error> {
    let db_url = format!("sqlite:{}", db_path.to_str().unwrap());
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await?;

    sqlx::migrate!("./migrations").run(&pool).await?;

    Ok(pool)
}
```

**Step 3: Wire db into lib.rs**

In `src-tauri/src/lib.rs`, set up the app with the DB pool as managed state:

```rust
mod db;

use std::path::PathBuf;
use tauri::Manager;

pub struct AppState {
    pub db: sqlx::SqlitePool,
    pub device_id: String,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir: PathBuf = app.path().app_data_dir().unwrap();
            std::fs::create_dir_all(&data_dir).unwrap();
            let db_path = data_dir.join("wayward.db");

            let pool = tauri::async_runtime::block_on(db::init_db(&db_path))
                .expect("failed to initialize database");

            // Get or generate device ID
            let device_id = tauri::async_runtime::block_on(get_or_create_device_id(&pool))
                .expect("failed to get device id");

            app.manage(AppState { db: pool, device_id });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

async fn get_or_create_device_id(pool: &sqlx::SqlitePool) -> Result<String, sqlx::Error> {
    let row = sqlx::query_scalar::<_, String>(
        "SELECT value FROM config WHERE key = 'device_id'"
    )
    .fetch_optional(pool)
    .await?;

    if let Some(id) = row {
        return Ok(id);
    }

    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO config (key, value) VALUES ('device_id', ?)")
        .bind(&id)
        .execute(pool)
        .await?;
    Ok(id)
}
```

**Step 4: Verify it compiles and runs**

```bash
npm run tauri dev
```

Expected: app opens, DB file created in app data dir, no panics.

**Step 5: Commit**

```bash
git add src-tauri/migrations/ src-tauri/src/db.rs src-tauri/src/lib.rs
git commit -m "feat: add SQLite database with migrations"
```

---

## Task 4: Task business logic + tests

**Files:**
- Create: `src-tauri/src/tasks.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: Write the failing tests**

Create `src-tauri/src/tasks.rs` with tests first:

```rust
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct Task {
    pub id: String,
    pub name: String,
    pub quadrant: i64,
    pub completed: bool,
    pub position: i64,
    pub device_id: String,
    pub updated_at: i64,
    pub deleted_at: Option<i64>,
}

pub async fn create_task(
    pool: &SqlitePool,
    name: &str,
    quadrant: i64,
    device_id: &str,
) -> Result<Task, sqlx::Error> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();

    let position: i64 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(position), 0) + 1 FROM tasks WHERE quadrant = ? AND deleted_at IS NULL"
    )
    .bind(quadrant)
    .fetch_one(pool)
    .await?;

    sqlx::query(
        "INSERT INTO tasks (id, name, quadrant, completed, position, device_id, updated_at)
         VALUES (?, ?, ?, 0, ?, ?, ?)"
    )
    .bind(&id)
    .bind(name)
    .bind(quadrant)
    .bind(position)
    .bind(device_id)
    .bind(now)
    .execute(pool)
    .await?;

    get_task(pool, &id).await
}

pub async fn get_task(pool: &SqlitePool, id: &str) -> Result<Task, sqlx::Error> {
    sqlx::query_as::<_, Task>("SELECT * FROM tasks WHERE id = ?")
        .bind(id)
        .fetch_one(pool)
        .await
}

pub async fn list_tasks(pool: &SqlitePool, quadrant: i64) -> Result<Vec<Task>, sqlx::Error> {
    sqlx::query_as::<_, Task>(
        "SELECT * FROM tasks WHERE quadrant = ? AND deleted_at IS NULL ORDER BY position ASC"
    )
    .bind(quadrant)
    .fetch_all(pool)
    .await
}

pub async fn complete_task(pool: &SqlitePool, id: &str) -> Result<(), sqlx::Error> {
    let now = chrono::Utc::now().timestamp_millis();
    sqlx::query("UPDATE tasks SET completed = 1, updated_at = ? WHERE id = ?")
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn delete_task(pool: &SqlitePool, id: &str) -> Result<(), sqlx::Error> {
    let now = chrono::Utc::now().timestamp_millis();
    sqlx::query("UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ?")
        .bind(now)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_task_positions(
    pool: &SqlitePool,
    ordered_ids: &[String],
) -> Result<(), sqlx::Error> {
    let now = chrono::Utc::now().timestamp_millis();
    for (i, id) in ordered_ids.iter().enumerate() {
        sqlx::query("UPDATE tasks SET position = ?, updated_at = ? WHERE id = ?")
            .bind(i as i64)
            .bind(now)
            .bind(id)
            .execute(pool)
            .await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn test_pool() -> SqlitePool {
        let pool = SqlitePool::connect(":memory:").await.unwrap();
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
        pool
    }

    #[tokio::test]
    async fn test_create_task() {
        let pool = test_pool().await;
        let task = create_task(&pool, "Write report", 1, "device-a").await.unwrap();
        assert_eq!(task.name, "Write report");
        assert_eq!(task.quadrant, 1);
        assert!(!task.completed);
    }

    #[tokio::test]
    async fn test_list_tasks_by_quadrant() {
        let pool = test_pool().await;
        create_task(&pool, "Q1 task", 1, "device-a").await.unwrap();
        create_task(&pool, "Q2 task", 2, "device-a").await.unwrap();
        let q1 = list_tasks(&pool, 1).await.unwrap();
        let q2 = list_tasks(&pool, 2).await.unwrap();
        assert_eq!(q1.len(), 1);
        assert_eq!(q2.len(), 1);
        assert_eq!(q1[0].name, "Q1 task");
    }

    #[tokio::test]
    async fn test_complete_task() {
        let pool = test_pool().await;
        let task = create_task(&pool, "Finish feature", 1, "device-a").await.unwrap();
        complete_task(&pool, &task.id).await.unwrap();
        let updated = get_task(&pool, &task.id).await.unwrap();
        assert!(updated.completed);
    }

    #[tokio::test]
    async fn test_delete_task_is_soft() {
        let pool = test_pool().await;
        let task = create_task(&pool, "Delete me", 1, "device-a").await.unwrap();
        delete_task(&pool, &task.id).await.unwrap();
        let remaining = list_tasks(&pool, 1).await.unwrap();
        assert!(remaining.is_empty());
        // But record still exists in DB
        let deleted = get_task(&pool, &task.id).await.unwrap();
        assert!(deleted.deleted_at.is_some());
    }

    #[tokio::test]
    async fn test_positions_assigned_sequentially() {
        let pool = test_pool().await;
        let t1 = create_task(&pool, "First", 1, "device-a").await.unwrap();
        let t2 = create_task(&pool, "Second", 1, "device-a").await.unwrap();
        assert!(t1.position < t2.position);
    }
}
```

**Step 2: Add module to lib.rs**

```rust
mod tasks;
```

**Step 3: Run tests to verify they pass**

```bash
cd src-tauri && cargo test tasks
```

Expected: 5 tests pass.

**Step 4: Commit**

```bash
git add src-tauri/src/tasks.rs src-tauri/src/lib.rs
git commit -m "feat: add task business logic with tests"
```

---

## Task 5: Task Tauri commands

**Files:**
- Create: `src-tauri/src/commands/tasks.rs`
- Create: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: Create commands directory and mod.rs**

```bash
mkdir src-tauri/src/commands
```

Create `src-tauri/src/commands/mod.rs`:

```rust
pub mod tasks;
pub mod journal;
pub mod goals;
```

**Step 2: Write task commands**

Create `src-tauri/src/commands/tasks.rs`:

```rust
use crate::{tasks, AppState};
use tauri::State;

#[tauri::command]
pub async fn cmd_create_task(
    state: State<'_, AppState>,
    name: String,
    quadrant: i64,
) -> Result<tasks::Task, String> {
    tasks::create_task(&state.db, &name, quadrant, &state.device_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_list_tasks(
    state: State<'_, AppState>,
    quadrant: i64,
) -> Result<Vec<tasks::Task>, String> {
    tasks::list_tasks(&state.db, quadrant)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_complete_task(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    tasks::complete_task(&state.db, &id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_delete_task(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    tasks::delete_task(&state.db, &id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_update_task_positions(
    state: State<'_, AppState>,
    ordered_ids: Vec<String>,
) -> Result<(), String> {
    tasks::update_task_positions(&state.db, &ordered_ids)
        .await
        .map_err(|e| e.to_string())
}
```

**Step 3: Register commands in lib.rs**

```rust
mod commands;

// in the invoke_handler:
.invoke_handler(tauri::generate_handler![
    commands::tasks::cmd_create_task,
    commands::tasks::cmd_list_tasks,
    commands::tasks::cmd_complete_task,
    commands::tasks::cmd_delete_task,
    commands::tasks::cmd_update_task_positions,
])
```

**Step 4: Verify compilation**

```bash
cd src-tauri && cargo build
```

**Step 5: Commit**

```bash
git add src-tauri/src/commands/
git commit -m "feat: add task Tauri commands"
```

---

## Task 6: Journal business logic + tests

**Files:**
- Create: `src-tauri/src/journal.rs`

**Step 1: Write journal.rs with tests**

```rust
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct JournalEntry {
    pub id: String,
    pub content: String,
    pub date: String,
    pub created_at: i64,
    pub device_id: String,
    pub updated_at: i64,
    pub locked: bool,
    pub deleted_at: Option<i64>,
}

pub async fn create_entry(
    pool: &SqlitePool,
    content: &str,
    device_id: &str,
) -> Result<JournalEntry, sqlx::Error> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();
    let date = chrono::Utc::now().format("%Y-%m-%d").to_string();

    sqlx::query(
        "INSERT INTO journal_entries (id, content, date, created_at, device_id, updated_at, locked)
         VALUES (?, ?, ?, ?, ?, ?, 0)"
    )
    .bind(&id)
    .bind(content)
    .bind(&date)
    .bind(now)
    .bind(device_id)
    .bind(now)
    .execute(pool)
    .await?;

    get_entry(pool, &id).await
}

pub async fn get_entry(pool: &SqlitePool, id: &str) -> Result<JournalEntry, sqlx::Error> {
    sqlx::query_as::<_, JournalEntry>("SELECT * FROM journal_entries WHERE id = ?")
        .bind(id)
        .fetch_one(pool)
        .await
}

pub async fn list_entries_for_date(
    pool: &SqlitePool,
    date: &str,
) -> Result<Vec<JournalEntry>, sqlx::Error> {
    sqlx::query_as::<_, JournalEntry>(
        "SELECT * FROM journal_entries WHERE date = ? AND deleted_at IS NULL ORDER BY created_at ASC"
    )
    .bind(date)
    .fetch_all(pool)
    .await
}

pub async fn update_entry(
    pool: &SqlitePool,
    id: &str,
    content: &str,
) -> Result<(), sqlx::Error> {
    let now = chrono::Utc::now().timestamp_millis();
    // Only update if not locked
    let locked: bool = sqlx::query_scalar("SELECT locked FROM journal_entries WHERE id = ?")
        .bind(id)
        .fetch_one(pool)
        .await?;

    if locked {
        return Err(sqlx::Error::RowNotFound); // caller maps to "entry is locked" error
    }

    sqlx::query("UPDATE journal_entries SET content = ?, updated_at = ? WHERE id = ?")
        .bind(content)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Called by background task at midnight — locks all entries from previous day
pub async fn lock_entries_for_date(pool: &SqlitePool, date: &str) -> Result<(), sqlx::Error> {
    let now = chrono::Utc::now().timestamp_millis();
    sqlx::query("UPDATE journal_entries SET locked = 1, updated_at = ? WHERE date = ?")
        .bind(now)
        .bind(date)
        .execute(pool)
        .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn test_pool() -> SqlitePool {
        let pool = SqlitePool::connect(":memory:").await.unwrap();
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
        pool
    }

    #[tokio::test]
    async fn test_create_entry() {
        let pool = test_pool().await;
        let entry = create_entry(&pool, "Today I learned Rust", "device-a").await.unwrap();
        assert_eq!(entry.content, "Today I learned Rust");
        assert!(!entry.locked);
    }

    #[tokio::test]
    async fn test_entries_ordered_by_created_at() {
        let pool = test_pool().await;
        let e1 = create_entry(&pool, "First", "device-a").await.unwrap();
        let e2 = create_entry(&pool, "Second", "device-b").await.unwrap();
        let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
        let entries = list_entries_for_date(&pool, &today).await.unwrap();
        assert!(entries[0].created_at <= entries[1].created_at);
        let _ = (e1, e2);
    }

    #[tokio::test]
    async fn test_cannot_edit_locked_entry() {
        let pool = test_pool().await;
        let entry = create_entry(&pool, "Original", "device-a").await.unwrap();
        let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
        lock_entries_for_date(&pool, &today).await.unwrap();
        let result = update_entry(&pool, &entry.id, "Modified").await;
        assert!(result.is_err());
    }
}
```

**Step 2: Add module and run tests**

Add `mod journal;` to `lib.rs`.

```bash
cd src-tauri && cargo test journal
```

Expected: 3 tests pass.

**Step 3: Commit**

```bash
git add src-tauri/src/journal.rs src-tauri/src/lib.rs
git commit -m "feat: add journal business logic with tests"
```

---

## Task 7: Journal Tauri commands

**Files:**
- Create: `src-tauri/src/commands/journal.rs`

**Step 1: Write journal commands**

```rust
use crate::{journal, AppState};
use tauri::State;

#[tauri::command]
pub async fn cmd_create_journal_entry(
    state: State<'_, AppState>,
    content: String,
) -> Result<journal::JournalEntry, String> {
    journal::create_entry(&state.db, &content, &state.device_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_list_journal_entries(
    state: State<'_, AppState>,
    date: String,
) -> Result<Vec<journal::JournalEntry>, String> {
    journal::list_entries_for_date(&state.db, &date)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_update_journal_entry(
    state: State<'_, AppState>,
    id: String,
    content: String,
) -> Result<(), String> {
    journal::update_entry(&state.db, &id, &content)
        .await
        .map_err(|_| "Cannot edit a locked entry".to_string())
}
```

**Step 2: Register commands and verify build**

Add to `invoke_handler` in `lib.rs`:
```rust
commands::journal::cmd_create_journal_entry,
commands::journal::cmd_list_journal_entries,
commands::journal::cmd_update_journal_entry,
```

```bash
cd src-tauri && cargo build
```

**Step 3: Commit**

```bash
git add src-tauri/src/commands/journal.rs
git commit -m "feat: add journal Tauri commands"
```

---

## Task 8: Goals business logic + commands

**Files:**
- Create: `src-tauri/src/goals.rs`
- Create: `src-tauri/src/commands/goals.rs`

**Step 1: Write goals.rs**

```rust
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct Goal {
    pub id: String,
    pub name: String,
    pub locked_until: String,
    pub device_id: String,
    pub updated_at: i64,
    pub deleted_at: Option<i64>,
}

pub async fn create_goal(
    pool: &SqlitePool,
    name: &str,
    device_id: &str,
) -> Result<Goal, String> {
    let active_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM goals WHERE deleted_at IS NULL"
    )
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    if active_count >= 3 {
        return Err("Maximum of 3 active goals allowed".to_string());
    }

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();
    let locked_until = (chrono::Utc::now() + chrono::Duration::days(365))
        .format("%Y-%m-%d")
        .to_string();

    sqlx::query(
        "INSERT INTO goals (id, name, locked_until, device_id, updated_at) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(name)
    .bind(&locked_until)
    .bind(device_id)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    list_goals(pool).await.map(|mut g| g.remove(g.iter().position(|g| g.id == id).unwrap()))
}

pub async fn list_goals(pool: &SqlitePool) -> Result<Vec<Goal>, String> {
    sqlx::query_as::<_, Goal>("SELECT * FROM goals WHERE deleted_at IS NULL")
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())
}
```

**Step 2: Write a test**

Add to `goals.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    async fn test_pool() -> SqlitePool {
        let pool = SqlitePool::connect(":memory:").await.unwrap();
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
        pool
    }

    #[tokio::test]
    async fn test_max_three_goals() {
        let pool = test_pool().await;
        create_goal(&pool, "Goal 1", "device-a").await.unwrap();
        create_goal(&pool, "Goal 2", "device-a").await.unwrap();
        create_goal(&pool, "Goal 3", "device-a").await.unwrap();
        let result = create_goal(&pool, "Goal 4", "device-a").await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Maximum"));
    }
}
```

**Step 3: Run the test**

```bash
cd src-tauri && cargo test goals
```

Expected: 1 test passes.

**Step 4: Write goals commands**

Create `src-tauri/src/commands/goals.rs`:

```rust
use crate::{goals, AppState};
use tauri::State;

#[tauri::command]
pub async fn cmd_create_goal(
    state: State<'_, AppState>,
    name: String,
) -> Result<goals::Goal, String> {
    goals::create_goal(&state.db, &name, &state.device_id).await
}

#[tauri::command]
pub async fn cmd_list_goals(state: State<'_, AppState>) -> Result<Vec<goals::Goal>, String> {
    goals::list_goals(&state.db).await
}
```

Register in `lib.rs` invoke handler, then verify build.

**Step 5: Commit**

```bash
git add src-tauri/src/goals.rs src-tauri/src/commands/goals.rs
git commit -m "feat: add goals logic and commands"
```

---

## Task 9: Journal midnight locking background task

**Files:**
- Create: `src-tauri/src/lock_scheduler.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: Write the scheduler**

Create `src-tauri/src/lock_scheduler.rs`:

```rust
use crate::journal;
use sqlx::SqlitePool;
use std::time::Duration;

pub async fn run(pool: SqlitePool) {
    loop {
        let now = chrono::Utc::now();
        // Calculate seconds until next midnight UTC
        let tomorrow = (now + chrono::Duration::days(1))
            .date_naive()
            .and_hms_opt(0, 0, 1)
            .unwrap()
            .and_utc();
        let wait = (tomorrow - now).num_seconds().max(0) as u64;

        tokio::time::sleep(Duration::from_secs(wait)).await;

        let yesterday = (chrono::Utc::now() - chrono::Duration::days(1))
            .format("%Y-%m-%d")
            .to_string();

        if let Err(e) = journal::lock_entries_for_date(&pool, &yesterday).await {
            eprintln!("Failed to lock journal entries: {e}");
        }
    }
}
```

**Step 2: Spawn the scheduler in lib.rs setup**

In the `setup` closure, after managing AppState:

```rust
let pool_for_scheduler = pool.clone(); // clone before moving into AppState
tauri::async_runtime::spawn(lock_scheduler::run(pool_for_scheduler));
```

Note: Clone the pool before creating AppState. Update the setup block accordingly.

**Step 3: Verify build**

```bash
cd src-tauri && cargo build
```

**Step 4: Commit**

```bash
git add src-tauri/src/lock_scheduler.rs
git commit -m "feat: add midnight journal locking scheduler"
```

---

## Task 10: Svelte stores

**Files:**
- Create: `src/lib/stores/tasks.ts`
- Create: `src/lib/stores/journal.ts`
- Create: `src/lib/stores/goals.ts`
- Create: `src/lib/tauri.ts`

**Step 1: Create Tauri invoke wrapper**

Create `src/lib/tauri.ts`:

```typescript
import { invoke } from '@tauri-apps/api/core';

export { invoke };
```

**Step 2: Create task store**

Create `src/lib/stores/tasks.ts`:

```typescript
import { writable } from 'svelte/store';
import { invoke } from '$lib/tauri';

export interface Task {
  id: string;
  name: string;
  quadrant: number;
  completed: boolean;
  position: number;
  device_id: string;
  updated_at: number;
}

export const q1Tasks = writable<Task[]>([]);
export const q2Tasks = writable<Task[]>([]);

export async function loadTasks() {
  const [q1, q2] = await Promise.all([
    invoke<Task[]>('cmd_list_tasks', { quadrant: 1 }),
    invoke<Task[]>('cmd_list_tasks', { quadrant: 2 }),
  ]);
  q1Tasks.set(q1);
  q2Tasks.set(q2);
}

export async function addTask(name: string, quadrant: number) {
  await invoke('cmd_create_task', { name, quadrant });
  await loadTasks();
}

export async function completeTask(id: string) {
  await invoke('cmd_complete_task', { id });
  await loadTasks();
}

export async function deleteTask(id: string) {
  await invoke('cmd_delete_task', { id });
  await loadTasks();
}

export async function reorderTasks(orderedIds: string[], quadrant: number) {
  await invoke('cmd_update_task_positions', { ordered_ids: orderedIds });
  await loadTasks();
}
```

**Step 3: Create journal store**

Create `src/lib/stores/journal.ts`:

```typescript
import { writable } from 'svelte/store';
import { invoke } from '$lib/tauri';

export interface JournalEntry {
  id: string;
  content: string;
  date: string;
  created_at: number;
  device_id: string;
  locked: boolean;
}

export const currentDateEntries = writable<JournalEntry[]>([]);
export const selectedDate = writable<string>(new Date().toISOString().split('T')[0]);

export async function loadEntriesForDate(date: string) {
  const entries = await invoke<JournalEntry[]>('cmd_list_journal_entries', { date });
  currentDateEntries.set(entries);
}

export async function addEntry(content: string) {
  await invoke('cmd_create_journal_entry', { content });
  const today = new Date().toISOString().split('T')[0];
  await loadEntriesForDate(today);
}
```

**Step 4: Create goals store**

Create `src/lib/stores/goals.ts`:

```typescript
import { writable } from 'svelte/store';
import { invoke } from '$lib/tauri';

export interface Goal {
  id: string;
  name: string;
  locked_until: string;
}

export const goals = writable<Goal[]>([]);

export async function loadGoals() {
  const result = await invoke<Goal[]>('cmd_list_goals');
  goals.set(result);
}

export async function addGoal(name: string) {
  await invoke('cmd_create_goal', { name });
  await loadGoals();
}
```

**Step 5: Commit**

```bash
git add src/lib/
git commit -m "feat: add Svelte stores for tasks, journal, and goals"
```

---

## Task 11: Do mode UI

**Files:**
- Create: `src/routes/do/+page.svelte`
- Create: `src/lib/components/TaskList.svelte`
- Create: `src/lib/components/AddTaskForm.svelte`

**Step 1: Create TaskList component**

Create `src/lib/components/TaskList.svelte`:

```svelte
<script lang="ts">
  import type { Task } from '$lib/stores/tasks';
  import { completeTask, deleteTask } from '$lib/stores/tasks';

  export let tasks: Task[];
  export let quadrant: number;
</script>

<ul class="task-list">
  {#each tasks as task (task.id)}
    <li class="task-item" class:completed={task.completed}>
      <span class="task-name">{task.name}</span>
      <div class="task-actions">
        <button on:click={() => completeTask(task.id)}>Done</button>
        <button on:click={() => deleteTask(task.id)}>Delete</button>
      </div>
    </li>
  {/each}
</ul>
```

**Step 2: Create AddTaskForm component**

Create `src/lib/components/AddTaskForm.svelte`:

```svelte
<script lang="ts">
  import { addTask } from '$lib/stores/tasks';

  export let quadrant: number;
  let name = '';

  async function handleSubmit() {
    if (!name.trim()) return;
    await addTask(name.trim(), quadrant);
    name = '';
  }
</script>

<form on:submit|preventDefault={handleSubmit}>
  <input bind:value={name} placeholder="Add task..." />
  <button type="submit">Add</button>
</form>
```

**Step 3: Create Do mode page**

Create `src/routes/do/+page.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { q1Tasks, q2Tasks, loadTasks } from '$lib/stores/tasks';
  import TaskList from '$lib/components/TaskList.svelte';
  import AddTaskForm from '$lib/components/AddTaskForm.svelte';

  onMount(loadTasks);
</script>

<main>
  <section class="quadrant q1">
    <h2>Urgent & Important</h2>
    <AddTaskForm quadrant={1} />
    <TaskList tasks={$q1Tasks} quadrant={1} />
  </section>

  <section class="quadrant q2">
    <h2>What Matters</h2>
    <p class="q2-philosophy">These take the time they need.</p>
    <AddTaskForm quadrant={2} />
    <TaskList tasks={$q2Tasks} quadrant={2} />
  </section>
</main>
```

**Step 4: Verify in dev mode**

```bash
npm run tauri dev
```

Navigate to `/do`. Add tasks to Q1 and Q2. Verify they appear and can be completed.

**Step 5: Commit**

```bash
git add src/routes/do/ src/lib/components/TaskList.svelte src/lib/components/AddTaskForm.svelte
git commit -m "feat: add Do mode UI with Q1 and Q2 task lists"
```

---

## Task 12: Journal mode UI

**Files:**
- Create: `src/routes/journal/+page.svelte`
- Create: `src/lib/components/JournalEntryForm.svelte`

**Step 1: Create JournalEntryForm**

Create `src/lib/components/JournalEntryForm.svelte`:

```svelte
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
  <textarea bind:value={content} placeholder="Write a thought..." rows="3" />
  <button type="submit">Add Entry</button>
</form>
```

**Step 2: Create Journal page**

Create `src/routes/journal/+page.svelte`:

```svelte
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

  <div class="entries">
    {#each $currentDateEntries as entry (entry.id)}
      <div class="entry" class:locked={entry.locked}>
        <time>{new Date(entry.created_at).toLocaleTimeString()}</time>
        <p>{entry.content}</p>
        {#if entry.locked}
          <span class="lock-badge">Locked</span>
        {/if}
      </div>
    {/each}
  </div>
</main>
```

**Step 3: Verify**

```bash
npm run tauri dev
```

Navigate to `/journal`. Add entries. Verify they appear in chronological order.

**Step 4: Commit**

```bash
git add src/routes/journal/ src/lib/components/JournalEntryForm.svelte
git commit -m "feat: add Journal mode UI"
```

---

## Task 13: Navigation shell

**Files:**
- Modify: `src/routes/+layout.svelte`
- Create: `src/app.html` (already exists from scaffold)

**Step 1: Create layout with navigation**

Create `src/routes/+layout.svelte`:

```svelte
<script>
  import { page } from '$app/stores';
</script>

<nav>
  <a href="/do" class:active={$page.url.pathname.startsWith('/do')}>Do</a>
  <a href="/journal" class:active={$page.url.pathname.startsWith('/journal')}>Journal</a>
  <a href="/goals" class:active={$page.url.pathname.startsWith('/goals')}>Goals</a>
</nav>

<slot />
```

**Step 2: Verify navigation works across all modes**

```bash
npm run tauri dev
```

Click between Do, Journal, Goals. State should persist within a session.

**Step 3: Commit**

```bash
git add src/routes/+layout.svelte
git commit -m "feat: add navigation layout"
```

---

## Task 14: Sync — Device identity and peer storage

**Files:**
- Create: `src-tauri/src/sync/mod.rs`
- Create: `src-tauri/src/sync/peer.rs`

**Step 1: Create sync module**

```bash
mkdir src-tauri/src/sync
```

Create `src-tauri/src/sync/mod.rs`:

```rust
pub mod peer;
pub mod server;
pub mod discovery;
pub mod protocol;
```

**Step 2: Write peer storage**

Create `src-tauri/src/sync/peer.rs`:

```rust
use sqlx::SqlitePool;
use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Peer {
    pub id: String,
    pub name: String,
    pub last_synced_at: i64,
}

pub async fn save_peer(pool: &SqlitePool, id: &str, name: &str) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO devices (id, name, last_synced_at) VALUES (?, ?, 0)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name"
    )
    .bind(id)
    .bind(name)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn list_peers(pool: &SqlitePool) -> Result<Vec<Peer>, sqlx::Error> {
    sqlx::query_as::<_, Peer>("SELECT * FROM devices")
        .fetch_all(pool)
        .await
}

pub async fn update_last_synced(pool: &SqlitePool, peer_id: &str) -> Result<(), sqlx::Error> {
    let now = chrono::Utc::now().timestamp_millis();
    sqlx::query("UPDATE devices SET last_synced_at = ? WHERE id = ?")
        .bind(now)
        .bind(peer_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn get_last_synced(pool: &SqlitePool, peer_id: &str) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar("SELECT last_synced_at FROM devices WHERE id = ?")
        .bind(peer_id)
        .fetch_one(pool)
        .await
}
```

**Step 3: Add sync module to lib.rs**

```rust
mod sync;
```

**Step 4: Verify build**

```bash
cd src-tauri && cargo build
```

**Step 5: Commit**

```bash
git add src-tauri/src/sync/
git commit -m "feat: add sync module and peer storage"
```

---

## Task 15: Sync — Diff protocol

**Files:**
- Create: `src-tauri/src/sync/protocol.rs`

**Step 1: Write the diff types and collection logic**

Create `src-tauri/src/sync/protocol.rs`:

```rust
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncDiff {
    pub device_id: String,
    pub tasks: Vec<crate::tasks::Task>,
    pub journal_entries: Vec<crate::journal::JournalEntry>,
    pub goals: Vec<crate::goals::Goal>,
}

/// Collect all records changed since `since_ms` (for sending to a peer)
pub async fn collect_diff(
    pool: &SqlitePool,
    device_id: &str,
    since_ms: i64,
) -> Result<SyncDiff, sqlx::Error> {
    let tasks = sqlx::query_as::<_, crate::tasks::Task>(
        "SELECT * FROM tasks WHERE updated_at > ?"
    )
    .bind(since_ms)
    .fetch_all(pool)
    .await?;

    let journal_entries = sqlx::query_as::<_, crate::journal::JournalEntry>(
        "SELECT * FROM journal_entries WHERE updated_at > ?"
    )
    .bind(since_ms)
    .fetch_all(pool)
    .await?;

    let goals = sqlx::query_as::<_, crate::goals::Goal>(
        "SELECT * FROM goals WHERE updated_at > ?"
    )
    .bind(since_ms)
    .fetch_all(pool)
    .await?;

    Ok(SyncDiff { device_id: device_id.to_string(), tasks, journal_entries, goals })
}

/// Apply a received diff — last-write-wins on updated_at per record
pub async fn apply_diff(pool: &SqlitePool, diff: &SyncDiff) -> Result<(), sqlx::Error> {
    for task in &diff.tasks {
        sqlx::query(
            "INSERT INTO tasks (id, name, quadrant, completed, position, device_id, updated_at, deleted_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               name = CASE WHEN excluded.updated_at > updated_at THEN excluded.name ELSE name END,
               quadrant = CASE WHEN excluded.updated_at > updated_at THEN excluded.quadrant ELSE quadrant END,
               completed = CASE WHEN excluded.updated_at > updated_at THEN excluded.completed ELSE completed END,
               position = CASE WHEN excluded.updated_at > updated_at THEN excluded.position ELSE position END,
               deleted_at = CASE WHEN excluded.updated_at > updated_at THEN excluded.deleted_at ELSE deleted_at END,
               updated_at = MAX(excluded.updated_at, updated_at)"
        )
        .bind(&task.id).bind(&task.name).bind(task.quadrant)
        .bind(task.completed).bind(task.position).bind(&task.device_id)
        .bind(task.updated_at).bind(task.deleted_at)
        .execute(pool).await?;
    }

    for entry in &diff.journal_entries {
        sqlx::query(
            "INSERT INTO journal_entries (id, content, date, created_at, device_id, updated_at, locked, deleted_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               content = CASE WHEN excluded.updated_at > updated_at THEN excluded.content ELSE content END,
               locked = CASE WHEN excluded.updated_at > updated_at THEN excluded.locked ELSE locked END,
               deleted_at = CASE WHEN excluded.updated_at > updated_at THEN excluded.deleted_at ELSE deleted_at END,
               updated_at = MAX(excluded.updated_at, updated_at)"
        )
        .bind(&entry.id).bind(&entry.content).bind(&entry.date)
        .bind(entry.created_at).bind(&entry.device_id).bind(entry.updated_at)
        .bind(entry.locked).bind(entry.deleted_at)
        .execute(pool).await?;
    }

    Ok(())
}
```

**Step 2: Verify build**

```bash
cd src-tauri && cargo build
```

**Step 3: Commit**

```bash
git add src-tauri/src/sync/protocol.rs
git commit -m "feat: add sync diff protocol (collect + apply)"
```

---

## Task 16: Sync — TCP server + mDNS

**Files:**
- Create: `src-tauri/src/sync/server.rs`
- Create: `src-tauri/src/sync/discovery.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: Write the TCP sync server**

Create `src-tauri/src/sync/server.rs`:

```rust
use crate::sync::protocol::{apply_diff, collect_diff, SyncDiff};
use sqlx::SqlitePool;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

pub async fn run(pool: SqlitePool, device_id: String, port: u16) {
    let listener = TcpListener::bind(format!("0.0.0.0:{port}")).await.unwrap();

    loop {
        let Ok((mut stream, _)) = listener.accept().await else { continue };
        let pool = pool.clone();
        let device_id = device_id.clone();

        tokio::spawn(async move {
            // Read peer's diff
            let mut len_buf = [0u8; 4];
            if stream.read_exact(&mut len_buf).await.is_err() { return; }
            let len = u32::from_be_bytes(len_buf) as usize;
            let mut buf = vec![0u8; len];
            if stream.read_exact(&mut buf).await.is_err() { return; }

            let Ok(peer_diff) = serde_json::from_slice::<SyncDiff>(&buf) else { return };
            let peer_id = peer_diff.device_id.clone();

            let _ = apply_diff(&pool, &peer_diff).await;

            // Send our diff
            let since_ms = crate::sync::peer::get_last_synced(&pool, &peer_id)
                .await.unwrap_or(0);
            let Ok(our_diff) = collect_diff(&pool, &device_id, since_ms).await else { return };
            let Ok(payload) = serde_json::to_vec(&our_diff) else { return };

            let len = (payload.len() as u32).to_be_bytes();
            let _ = stream.write_all(&len).await;
            let _ = stream.write_all(&payload).await;

            let _ = crate::sync::peer::update_last_synced(&pool, &peer_id).await;
        });
    }
}
```

**Step 2: Write mDNS discovery**

Create `src-tauri/src/sync/discovery.rs`:

```rust
use mdns_sd::{ServiceDaemon, ServiceEvent, ServiceInfo};
use sqlx::SqlitePool;

const SERVICE_TYPE: &str = "_wayward._tcp.local.";

pub async fn broadcast(device_id: &str, port: u16) {
    let mdns = ServiceDaemon::new().expect("mDNS daemon failed");
    let service_info = ServiceInfo::new(
        SERVICE_TYPE,
        device_id,
        &format!("{}.local.", hostname()),
        "",
        port,
        None,
    )
    .expect("Invalid service info");
    mdns.register(service_info).expect("mDNS register failed");
    // Keep alive forever
    std::future::pending::<()>().await;
}

pub async fn discover_and_sync(pool: SqlitePool, device_id: String, our_port: u16) {
    let mdns = ServiceDaemon::new().expect("mDNS daemon failed");
    let receiver = mdns.browse(SERVICE_TYPE).expect("mDNS browse failed");

    while let Ok(event) = receiver.recv_async().await {
        if let ServiceEvent::ServiceResolved(info) = event {
            let peer_name = info.get_fullname().to_string();
            if peer_name.contains(&device_id) { continue; } // skip ourselves

            for addr in info.get_addresses() {
                let port = info.get_port();
                let pool = pool.clone();
                let device_id = device_id.clone();
                let addr = *addr;

                tokio::spawn(async move {
                    sync_with_peer(&pool, &device_id, addr, port).await;
                });
                break;
            }
        }
    }
}

async fn sync_with_peer(
    pool: &SqlitePool,
    device_id: &str,
    addr: std::net::IpAddr,
    port: u16,
) {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpStream;

    let Ok(mut stream) = TcpStream::connect((addr, port)).await else { return };

    let peer_id = "unknown"; // will be learned from their diff
    let since_ms = crate::sync::peer::get_last_synced(pool, peer_id).await.unwrap_or(0);
    let Ok(our_diff) = crate::sync::protocol::collect_diff(pool, device_id, since_ms).await else { return };
    let Ok(payload) = serde_json::to_vec(&our_diff) else { return };

    let len = (payload.len() as u32).to_be_bytes();
    let _ = stream.write_all(&len).await;
    let _ = stream.write_all(&payload).await;

    // Receive their diff
    let mut len_buf = [0u8; 4];
    if stream.read_exact(&mut len_buf).await.is_err() { return; }
    let len = u32::from_be_bytes(len_buf) as usize;
    let mut buf = vec![0u8; len];
    if stream.read_exact(&mut buf).await.is_err() { return; }

    if let Ok(peer_diff) = serde_json::from_slice::<crate::sync::protocol::SyncDiff>(&buf) {
        let peer_id = peer_diff.device_id.clone();
        let _ = crate::sync::protocol::apply_diff(pool, &peer_diff).await;
        let _ = crate::sync::peer::update_last_synced(pool, &peer_id).await;
    }
}

fn hostname() -> String {
    hostname::get()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string()
}
```

Add `hostname = "0.3"` to Cargo.toml dependencies.

**Step 3: Spawn sync services in lib.rs setup**

After app state is managed:

```rust
let sync_port = 47832u16; // fixed port for simplicity
let pool_server = pool.clone();
let pool_discover = pool.clone();
let device_id_server = device_id.clone();
let device_id_discover = device_id.clone();

tauri::async_runtime::spawn(sync::server::run(pool_server, device_id_server, sync_port));
tauri::async_runtime::spawn(sync::discovery::broadcast(&device_id, sync_port));
tauri::async_runtime::spawn(sync::discovery::discover_and_sync(pool_discover, device_id_discover, sync_port));
```

**Step 4: Verify build**

```bash
cd src-tauri && cargo build
```

**Step 5: Commit**

```bash
git add src-tauri/src/sync/
git commit -m "feat: add LAN sync via mDNS discovery and TCP server"
```

---

## Task 17: Build for all targets

**Step 1: Build desktop**

```bash
npm run tauri build
```

Expected: produces binaries in `src-tauri/target/release/bundle/`.

**Step 2: Add mobile targets (first time)**

```bash
npm run tauri android init
npm run tauri ios init   # macOS only
```

**Step 3: Run on mobile**

```bash
npm run tauri android dev
npm run tauri ios dev    # macOS only
```

**Step 4: Commit any platform config changes**

```bash
git add src-tauri/gen/
git commit -m "chore: add mobile platform targets"
```

---

## Notes

- The sync port `47832` is hardcoded for now. A future improvement is to use a random available port announced via mDNS TXT record.
- Goals deletion (before `locked_until`) is intentionally omitted — if needed later, it requires a deliberate UI confirmation step.
- The Q2 philosophy ("these take the time they need") should be reflected in UI copy — never show a count of "overdue" tasks.
