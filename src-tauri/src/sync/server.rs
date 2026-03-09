use crate::sync::{peer, protocol};
use sqlx::SqlitePool;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

pub async fn run(pool: SqlitePool, device_id: String, port: u16) {
    let listener = match TcpListener::bind(format!("0.0.0.0:{port}")).await {
        Ok(l) => l,
        Err(e) => {
            eprintln!("Sync server failed to bind on port {port}: {e}");
            return;
        }
    };

    loop {
        let Ok((mut stream, _addr)) = listener.accept().await else {
            continue;
        };
        let pool = pool.clone();
        let device_id = device_id.clone();

        tokio::spawn(async move {
            // Read peer's diff
            let mut len_buf = [0u8; 4];
            if stream.read_exact(&mut len_buf).await.is_err() {
                return;
            }
            let len = u32::from_be_bytes(len_buf) as usize;
            let mut buf = vec![0u8; len];
            if stream.read_exact(&mut buf).await.is_err() {
                return;
            }

            let Ok(peer_diff) = serde_json::from_slice::<protocol::SyncDiff>(&buf) else {
                return;
            };
            let peer_id = peer_diff.device_id.clone();

            let _ = protocol::apply_diff(&pool, &peer_diff).await;

            // Send our diff back
            let since_ms = peer::get_last_synced(&pool, &peer_id).await.unwrap_or(0);
            let Ok(our_diff) = protocol::collect_diff(&pool, &device_id, since_ms).await else {
                return;
            };
            let Ok(payload) = serde_json::to_vec(&our_diff) else {
                return;
            };

            let len_bytes = (payload.len() as u32).to_be_bytes();
            if stream.write_all(&len_bytes).await.is_err() {
                return;
            }
            if stream.write_all(&payload).await.is_err() {
                return;
            }

            let _ = peer::update_last_synced(&pool, &peer_id).await;
        });
    }
}
