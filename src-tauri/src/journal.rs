use crate::crypto;
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
    key: Option<&[u8; 32]>,
) -> Result<JournalEntry, sqlx::Error> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();
    let date = chrono::Utc::now().format("%Y-%m-%d").to_string();

    let stored_content = match key {
        Some(k) => crypto::encrypt(k, content)
            .map_err(|e| sqlx::Error::Protocol(e))?,
        None => content.to_string(),
    };

    sqlx::query(
        "INSERT INTO journal_entries (id, content, date, created_at, device_id, updated_at, locked)
         VALUES (?, ?, ?, ?, ?, ?, 0)",
    )
    .bind(&id)
    .bind(&stored_content)
    .bind(&date)
    .bind(now)
    .bind(device_id)
    .bind(now)
    .execute(pool)
    .await?;

    get_entry(pool, &id, key).await
}

pub async fn get_entry(
    pool: &SqlitePool,
    id: &str,
    key: Option<&[u8; 32]>,
) -> Result<JournalEntry, sqlx::Error> {
    let mut entry = sqlx::query_as::<_, JournalEntry>(
        "SELECT * FROM journal_entries WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(id)
    .fetch_one(pool)
    .await?;

    if let Some(k) = key {
        entry.content = crypto::decrypt(k, &entry.content)
            .map_err(|e| sqlx::Error::Protocol(e))?;
    }
    Ok(entry)
}

pub async fn list_entries_for_date(
    pool: &SqlitePool,
    date: &str,
    key: Option<&[u8; 32]>,
) -> Result<Vec<JournalEntry>, sqlx::Error> {
    let mut entries = sqlx::query_as::<_, JournalEntry>(
        "SELECT * FROM journal_entries WHERE date = ? AND deleted_at IS NULL ORDER BY created_at ASC",
    )
    .bind(date)
    .fetch_all(pool)
    .await?;

    if let Some(k) = key {
        for entry in entries.iter_mut() {
            entry.content = crypto::decrypt(k, &entry.content)
                .map_err(|e| sqlx::Error::Protocol(e))?;
        }
    }
    Ok(entries)
}

pub async fn update_entry(
    pool: &SqlitePool,
    id: &str,
    content: &str,
    key: Option<&[u8; 32]>,
) -> Result<(), sqlx::Error> {
    let now = chrono::Utc::now().timestamp_millis();
    let locked: Option<bool> =
        sqlx::query_scalar("SELECT locked FROM journal_entries WHERE id = ? AND deleted_at IS NULL")
            .bind(id)
            .fetch_optional(pool)
            .await?;

    match locked {
        None => return Err(sqlx::Error::RowNotFound),
        Some(true) => return Err(sqlx::Error::RowNotFound),
        Some(false) => {}
    }

    let stored_content = match key {
        Some(k) => crypto::encrypt(k, content)
            .map_err(|e| sqlx::Error::Protocol(e))?,
        None => content.to_string(),
    };

    sqlx::query("UPDATE journal_entries SET content = ?, updated_at = ? WHERE id = ?")
        .bind(&stored_content)
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

pub async fn list_dates(pool: &SqlitePool) -> Result<Vec<String>, sqlx::Error> {
    sqlx::query_scalar::<_, String>(
        "SELECT DISTINCT date FROM journal_entries WHERE deleted_at IS NULL ORDER BY date DESC",
    )
    .fetch_all(pool)
    .await
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
        let entry = create_entry(&pool, "Today I learned Rust", "device-a", None).await.unwrap();
        assert_eq!(entry.content, "Today I learned Rust");
        assert!(!entry.locked);
    }

    #[tokio::test]
    async fn test_entries_ordered_by_created_at() {
        let pool = test_pool().await;
        create_entry(&pool, "First", "device-a", None).await.unwrap();
        create_entry(&pool, "Second", "device-b", None).await.unwrap();
        let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
        let entries = list_entries_for_date(&pool, &today, None).await.unwrap();
        assert_eq!(entries.len(), 2);
        assert!(entries[0].created_at <= entries[1].created_at);
    }

    #[tokio::test]
    async fn test_cannot_edit_locked_entry() {
        let pool = test_pool().await;
        let entry = create_entry(&pool, "Original", "device-a", None).await.unwrap();
        let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
        lock_entries_for_date(&pool, &today).await.unwrap();
        let result = update_entry(&pool, &entry.id, "Modified", None).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_entry_content_encrypted_at_rest() {
        let pool = test_pool().await;
        let key = crate::crypto::setup_password(&pool, "pass", "1234").await.unwrap();
        let entry = create_entry(&pool, "Private thoughts", "device-a", Some(&key)).await.unwrap();

        // Content in DB should NOT be the original plaintext
        let raw: String = sqlx::query_scalar(
            "SELECT content FROM journal_entries WHERE id = ?"
        )
        .bind(&entry.id)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_ne!(raw, "Private thoughts");
        // But the returned entry should be decrypted
        assert_eq!(entry.content, "Private thoughts");
    }

    #[tokio::test]
    async fn test_list_entries_decrypted() {
        let pool = test_pool().await;
        let key = crate::crypto::setup_password(&pool, "pass", "1234").await.unwrap();
        create_entry(&pool, "Entry one", "device-a", Some(&key)).await.unwrap();
        let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
        let entries = list_entries_for_date(&pool, &today, Some(&key)).await.unwrap();
        assert_eq!(entries[0].content, "Entry one");
    }

    #[tokio::test]
    async fn test_list_dates_returns_distinct_dates() {
        let pool = test_pool().await;
        let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
        create_entry(&pool, "First", "device-a", None).await.unwrap();
        create_entry(&pool, "Second", "device-a", None).await.unwrap();
        let dates = list_dates(&pool).await.unwrap();
        assert_eq!(dates.len(), 1);
        assert_eq!(dates[0], today);
    }
}
