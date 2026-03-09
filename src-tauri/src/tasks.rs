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
