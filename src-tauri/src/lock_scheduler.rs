use crate::journal;
use sqlx::SqlitePool;
use std::time::Duration;

pub async fn run(pool: SqlitePool) {
    loop {
        let now = chrono::Utc::now();
        let tomorrow = (now + chrono::Duration::days(1))
            .date_naive()
            .and_hms_opt(0, 0, 1)
            .unwrap()
            .and_utc();
        let wait_secs = (tomorrow - now).num_seconds().max(0) as u64;

        tokio::time::sleep(Duration::from_secs(wait_secs)).await;

        let yesterday = (chrono::Utc::now() - chrono::Duration::days(1))
            .format("%Y-%m-%d")
            .to_string();

        if let Err(e) = journal::lock_entries_for_date(&pool, &yesterday).await {
            eprintln!("Failed to lock journal entries: {e}");
        }
    }
}
