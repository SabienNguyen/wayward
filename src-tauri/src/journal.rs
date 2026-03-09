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
    let locked: bool = sqlx::query_scalar("SELECT locked FROM journal_entries WHERE id = ?")
        .bind(id)
        .fetch_one(pool)
        .await?;

    if locked {
        return Err(sqlx::Error::RowNotFound);
    }

    sqlx::query("UPDATE journal_entries SET content = ?, updated_at = ? WHERE id = ?")
        .bind(content)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Called by background task at midnight — locks all entries from the given date
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
        create_entry(&pool, "First", "device-a").await.unwrap();
        create_entry(&pool, "Second", "device-b").await.unwrap();
        let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
        let entries = list_entries_for_date(&pool, &today).await.unwrap();
        assert_eq!(entries.len(), 2);
        assert!(entries[0].created_at <= entries[1].created_at);
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
