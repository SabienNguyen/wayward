use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

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
        .fetch_optional(pool)
        .await
        .map(|opt| opt.unwrap_or(0))
}
