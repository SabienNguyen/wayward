use crate::sync::{peer, protocol};
use mdns_sd::{ServiceDaemon, ServiceEvent, ServiceInfo};
use sqlx::SqlitePool;

const SERVICE_TYPE: &str = "_wayward._tcp.local.";

pub fn broadcast(device_id: String, port: u16) {
    let mdns = match ServiceDaemon::new() {
        Ok(m) => m,
        Err(e) => {
            eprintln!("mDNS daemon failed: {e}");
            return;
        }
    };

    let hostname = hostname::get()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let host = format!("{hostname}.local.");

    let service_info = match ServiceInfo::new(
        SERVICE_TYPE,
        &device_id,
        &host,
        "",
        port,
        None,
    ) {
        Ok(info) => info,
        Err(e) => {
            eprintln!("mDNS service info error: {e}");
            return;
        }
    };

    if let Err(e) = mdns.register(service_info) {
        eprintln!("mDNS register failed: {e}");
    }
    // mdns daemon runs in background — drop guard keeps it alive
    std::mem::forget(mdns);
}

pub async fn discover_and_sync(pool: SqlitePool, device_id: String) {
    let mdns = match ServiceDaemon::new() {
        Ok(m) => m,
        Err(e) => {
            eprintln!("mDNS discovery daemon failed: {e}");
            return;
        }
    };

    let receiver = match mdns.browse(SERVICE_TYPE) {
        Ok(r) => r,
        Err(e) => {
            eprintln!("mDNS browse failed: {e}");
            return;
        }
    };

    while let Ok(event) = receiver.recv_async().await {
        if let ServiceEvent::ServiceResolved(info) = event {
            // Skip ourselves
            if info.get_fullname().contains(&device_id) {
                continue;
            }

            let port = info.get_port();
            for addr in info.get_addresses() {
                let pool = pool.clone();
                let device_id = device_id.clone();
                let addr = *addr;

                tokio::spawn(async move {
                    sync_with_peer(&pool, &device_id, addr, port).await;
                });
                break; // only try first address
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

    let Ok(mut stream) = TcpStream::connect((addr, port)).await else {
        return;
    };

    // Send our diff (since_ms=0 for new peers, we'll refine after learning their ID)
    let Ok(our_diff) = protocol::collect_diff(pool, device_id, 0).await else {
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

    // Receive their diff
    let mut len_buf = [0u8; 4];
    if stream.read_exact(&mut len_buf).await.is_err() {
        return;
    }
    let len = u32::from_be_bytes(len_buf) as usize;
    let mut buf = vec![0u8; len];
    if stream.read_exact(&mut buf).await.is_err() {
        return;
    }

    if let Ok(peer_diff) = serde_json::from_slice::<protocol::SyncDiff>(&buf) {
        let peer_id = peer_diff.device_id.clone();
        let peer_name = format!("{}:{}", addr, port);
        let _ = peer::save_peer(pool, &peer_id, &peer_name).await;
        let _ = protocol::apply_diff(pool, &peer_diff).await;
        let _ = peer::update_last_synced(pool, &peer_id).await;
    }
}
