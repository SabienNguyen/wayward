mod commands;
mod db;
mod tasks;
mod journal;
mod goals;

use std::path::PathBuf;
use tauri::Manager;

pub struct AppState {
    pub db: sqlx::SqlitePool,
    pub device_id: String,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_dir: PathBuf = app.path().app_data_dir().unwrap();
            std::fs::create_dir_all(&data_dir).unwrap();
            let db_path = data_dir.join("wayward.db");

            let pool = tauri::async_runtime::block_on(db::init_db(&db_path))
                .expect("failed to initialize database");

            let device_id = tauri::async_runtime::block_on(get_or_create_device_id(&pool))
                .expect("failed to get device id");

            let pool_clone = pool.clone();
            app.manage(AppState { db: pool, device_id });
            let _ = pool_clone; // will be used by sync scheduler in a later task
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::tasks::cmd_create_task,
            commands::tasks::cmd_list_tasks,
            commands::tasks::cmd_complete_task,
            commands::tasks::cmd_delete_task,
            commands::tasks::cmd_update_task_positions,
            commands::journal::cmd_create_journal_entry,
            commands::journal::cmd_list_journal_entries,
            commands::journal::cmd_update_journal_entry,
            commands::goals::cmd_create_goal,
            commands::goals::cmd_list_goals,
        ])
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
