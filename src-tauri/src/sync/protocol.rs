use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncDiff {
    pub device_id: String,
    pub tasks: Vec<crate::tasks::Task>,
    pub journal_entries: Vec<crate::journal::JournalEntry>,
    pub goals: Vec<crate::goals::Goal>,
}

/// Collect all records changed since `since_ms` to send to a peer
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

    Ok(SyncDiff {
        device_id: device_id.to_string(),
        tasks,
        journal_entries,
        goals,
    })
}

/// Apply a received diff — last-write-wins per record based on updated_at
pub async fn apply_diff(pool: &SqlitePool, diff: &SyncDiff) -> Result<(), sqlx::Error> {
    for task in &diff.tasks {
        sqlx::query(
            "INSERT INTO tasks (id, name, quadrant, completed, position, device_id, updated_at, deleted_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               name       = CASE WHEN excluded.updated_at > updated_at THEN excluded.name       ELSE name       END,
               quadrant   = CASE WHEN excluded.updated_at > updated_at THEN excluded.quadrant   ELSE quadrant   END,
               completed  = CASE WHEN excluded.updated_at > updated_at THEN excluded.completed  ELSE completed  END,
               position   = CASE WHEN excluded.updated_at > updated_at THEN excluded.position   ELSE position   END,
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
               content    = CASE WHEN excluded.updated_at > updated_at THEN excluded.content    ELSE content    END,
               locked     = CASE WHEN excluded.updated_at > updated_at THEN excluded.locked     ELSE locked     END,
               deleted_at = CASE WHEN excluded.updated_at > updated_at THEN excluded.deleted_at ELSE deleted_at END,
               updated_at = MAX(excluded.updated_at, updated_at)"
        )
        .bind(&entry.id).bind(&entry.content).bind(&entry.date)
        .bind(entry.created_at).bind(&entry.device_id).bind(entry.updated_at)
        .bind(entry.locked).bind(entry.deleted_at)
        .execute(pool).await?;
    }

    for goal in &diff.goals {
        sqlx::query(
            "INSERT INTO goals (id, name, locked_until, device_id, updated_at, deleted_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               name        = CASE WHEN excluded.updated_at > updated_at THEN excluded.name        ELSE name        END,
               deleted_at  = CASE WHEN excluded.updated_at > updated_at THEN excluded.deleted_at  ELSE deleted_at  END,
               updated_at  = MAX(excluded.updated_at, updated_at)"
        )
        .bind(&goal.id).bind(&goal.name).bind(&goal.locked_until)
        .bind(&goal.device_id).bind(goal.updated_at).bind(goal.deleted_at)
        .execute(pool).await?;
    }

    Ok(())
}
