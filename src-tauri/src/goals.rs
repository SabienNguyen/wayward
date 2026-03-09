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

pub async fn create_goal(pool: &SqlitePool, name: &str, device_id: &str) -> Result<Goal, String> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM goals WHERE deleted_at IS NULL")
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;

    if count >= 3 {
        return Err("Maximum of 3 active goals allowed".to_string());
    }

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();

    let locked_until = (chrono::Utc::now() + chrono::Duration::days(365))
        .format("%Y-%m-%d")
        .to_string();

    sqlx::query(
        "INSERT INTO goals (id, name, locked_until, device_id, updated_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(name)
    .bind(&locked_until)
    .bind(device_id)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    list_goals(pool)
        .await
        .map(|mut g| g.remove(g.iter().position(|g| g.id == id).unwrap()))
}

pub async fn list_goals(pool: &SqlitePool) -> Result<Vec<Goal>, String> {
    sqlx::query_as::<_, Goal>("SELECT * FROM goals WHERE deleted_at IS NULL")
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())
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
    async fn test_max_three_goals() {
        let pool = test_pool().await;
        create_goal(&pool, "Goal 1", "device-a").await.unwrap();
        create_goal(&pool, "Goal 2", "device-a").await.unwrap();
        create_goal(&pool, "Goal 3", "device-a").await.unwrap();
        let result = create_goal(&pool, "Goal 4", "device-a").await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Maximum"));
    }

    #[tokio::test]
    async fn test_goal_locked_for_one_year() {
        let pool = test_pool().await;
        let goal = create_goal(&pool, "Learn Rust", "device-a").await.unwrap();
        let locked = chrono::NaiveDate::parse_from_str(&goal.locked_until, "%Y-%m-%d").unwrap();
        let today = chrono::Utc::now().date_naive();
        let diff = locked - today;
        // Should be ~365 days (allow 364-366 for timezone edge cases)
        assert!(diff.num_days() >= 364 && diff.num_days() <= 366);
    }
}
